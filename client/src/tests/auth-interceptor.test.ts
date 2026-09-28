/**
 * auth-interceptor.test.ts
 *
 * Regression tests for the refresh-loop / rate-limit-exhaustion bug.
 *
 * Symptom: After a session expires, TanStack Query's `retry: 1` caused each
 * failing query to re-trigger the 401 interceptor, which attempted another
 * POST /api/auth/refresh. With 5+ concurrent queries each retrying once,
 * up to 10 additional refresh calls fired in a single expired-session event —
 * easily exhausting the 20-req/15-min auth rate limiter and producing
 * "Too many authentication attempts" on subsequent login.
 *
 * Fix: a `refreshFailed` latch in api.ts that blocks further refresh attempts
 * once a /api/auth/refresh call itself has failed.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import MockAdapter from 'axios-mock-adapter'
import {
  api,
  setAccessToken,
  resetRefreshState,
  getAccessToken,
} from '@/lib/api'

let mockApi: InstanceType<typeof MockAdapter>
let mockAxios: InstanceType<typeof MockAdapter>

beforeEach(() => {
  mockApi = new MockAdapter(api)
  mockAxios = new MockAdapter(axios)
  resetRefreshState()
  setAccessToken(null)
})

afterEach(() => {
  mockApi.restore()
  mockAxios.restore()
  resetRefreshState()
  setAccessToken(null)
})

describe('refreshFailed latch — exported state helpers', () => {
  it('getAccessToken returns null initially', () => {
    expect(getAccessToken()).toBeNull()
  })

  it('setAccessToken stores the token', () => {
    setAccessToken('tok-abc')
    expect(getAccessToken()).toBe('tok-abc')
  })

  it('setAccessToken(null) clears the token', () => {
    setAccessToken('tok-abc')
    setAccessToken(null)
    expect(getAccessToken()).toBeNull()
  })

  it('resetRefreshState is callable without error', () => {
    expect(() => resetRefreshState()).not.toThrow()
  })

  it('setAccessToken with a value clears the refreshFailed latch (smoke)', () => {
    // After a simulated failure latch and recovery we should be able to call
    // setAccessToken without error.
    resetRefreshState()
    setAccessToken(null)
    setAccessToken('new-token')
    expect(getAccessToken()).toBe('new-token')
  })
})

describe('interceptor — only ONE refresh call for concurrent 401s', () => {
  it('fires exactly one /api/auth/refresh when multiple API calls hit 401 simultaneously', async () => {
    // Arrange: expired access token in memory
    setAccessToken('expired-token')

    let refreshCallCount = 0

    // The interceptor uses raw axios (not api) for the refresh call
    mockAxios.onPost('/api/auth/refresh').reply(() => {
      refreshCallCount++
      return [
        200,
        {
          success: true,
          data: { accessToken: 'fresh-token', user: { id: '1', role: 'ADVISOR' } },
        },
      ]
    })

    // First 401 wave for each endpoint on the `api` instance
    mockApi.onGet(/\/leads$/).replyOnce(401, { success: false })
    mockApi.onGet(/\/tasks$/).replyOnce(401, { success: false })
    mockApi.onGet(/\/leads\/pipeline$/).replyOnce(401, { success: false })

    // After token refresh, the retry succeeds
    mockApi.onGet(/\/leads$/).reply(200, { success: true, data: [] })
    mockApi.onGet(/\/tasks$/).reply(200, { success: true, data: [] })
    mockApi.onGet(/\/leads\/pipeline$/).reply(200, { success: true, data: [] })

    // Act: fire concurrently
    const results = await Promise.allSettled([
      api.get('/leads'),
      api.get('/tasks'),
      api.get('/leads/pipeline'),
    ])

    // Assert: only one refresh call regardless of 3 concurrent 401s
    expect(refreshCallCount).toBe(1)

    // All requests should ultimately succeed after the single refresh
    for (const r of results) {
      expect(r.status).toBe('fulfilled')
    }
  })
})

describe('interceptor — refreshFailed latch blocks subsequent refresh calls', () => {
  it('makes exactly ONE refresh call even when N subsequent 401s arrive after failure', async () => {
    setAccessToken('expired-token')

    let refreshCallCount = 0

    // Refresh endpoint is itself expired/invalid → 401
    mockAxios.onPost('/api/auth/refresh').reply(() => {
      refreshCallCount++
      return [401, { success: false, error: { code: 'UNAUTHORIZED' } }]
    })

    // All API endpoints return 401
    mockApi.onGet(/\/leads$/).reply(401, { success: false })
    mockApi.onGet(/\/tasks$/).reply(401, { success: false })
    mockApi.onGet(/\/leads\/pipeline$/).reply(401, { success: false })

    // Fire all at once — normally this would be 1 refresh call.
    await Promise.allSettled([
      api.get('/leads'),
      api.get('/tasks'),
      api.get('/leads/pipeline'),
    ])

    const countAfterFirstWave = refreshCallCount

    // Simulate TanStack Query retry:1 — each query retries once after failure
    await Promise.allSettled([
      api.get('/leads'),
      api.get('/tasks'),
      api.get('/leads/pipeline'),
    ])

    // CRITICAL: after the latch is set, NO additional refresh calls should fire.
    // Before the fix: this would be 2 (or more) — each retry wave triggering another attempt.
    expect(refreshCallCount).toBe(countAfterFirstWave)
    expect(refreshCallCount).toBe(1)
  })

  it('stops attempting refresh after first failure (sequential requests)', async () => {
    setAccessToken('expired-token')

    let refreshCallCount = 0
    mockAxios.onPost('/api/auth/refresh').reply(() => {
      refreshCallCount++
      return [401, { success: false }]
    })
    mockApi.onGet(/\/leads$/).reply(401, { success: false })

    // First request — triggers the one-and-only refresh attempt
    await api.get('/leads').catch(() => {})
    expect(refreshCallCount).toBe(1)

    // Second request — latch is set; must NOT trigger another refresh
    await api.get('/leads').catch(() => {})
    expect(refreshCallCount).toBe(1)

    // Third request — still blocked by latch
    await api.get('/leads').catch(() => {})
    expect(refreshCallCount).toBe(1)
  })

  it('resumes normal refresh after resetRefreshState clears the latch', async () => {
    setAccessToken('expired-token')

    let refreshCallCount = 0
    mockAxios.onPost('/api/auth/refresh').reply(() => {
      refreshCallCount++
      return [401, { success: false }]
    })
    mockApi.onGet(/\/leads$/).reply(401, { success: false })

    // Trigger first failure → sets latch
    await api.get('/leads').catch(() => {})
    expect(refreshCallCount).toBe(1)

    // Manually reset (simulates page reload / re-login clearing state)
    resetRefreshState()
    setAccessToken('expired-token')

    // Now a 401 should attempt refresh again
    await api.get('/leads').catch(() => {})
    expect(refreshCallCount).toBe(2)
  })
})
