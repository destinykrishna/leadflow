import axios from 'axios'
import { useQuery, useMutation } from '@tanstack/react-query'
import type { ApiResponse } from '@/types/api.types'
import type {
  IPublicFormView,
  PublicFormSubmissionPayload,
  PublicSubmissionResponse,
} from '@/types/form.types'

const apiBase = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api'

/**
 * Dedicated, unauthenticated Axios client for public form viewing and submission.
 * Strictly isolated: no auth request/response interceptors, no Bearer tokens attached,
 * and no 401 refresh token rotation logic triggered.
 */
export const publicApiClient = axios.create({
  baseURL: apiBase,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const publicFormQueryKeys = {
  detail: (brokerageIdentifier: string, slug: string) =>
    ['public-form', brokerageIdentifier, slug] as const,
}

/**
 * Fetches published form configuration by brokerage identifier and form slug.
 */
export async function getPublicForm(
  brokerageIdentifier: string,
  slug: string,
): Promise<IPublicFormView> {
  const cleanBrokerage = encodeURIComponent(brokerageIdentifier.trim().toLowerCase())
  const cleanSlug = encodeURIComponent(slug.trim().toLowerCase())

  const res = await publicApiClient.get<ApiResponse<IPublicFormView>>(
    `/forms/public/${cleanBrokerage}/${cleanSlug}`,
  )

  if (!res.data.data) {
    throw new Error(res.data.message || 'Form not found')
  }

  return res.data.data
}

/**
 * Submits public form responses to be converted into a Lead inquiry.
 */
export async function submitPublicForm(
  brokerageIdentifier: string,
  slug: string,
  payload: PublicFormSubmissionPayload,
): Promise<PublicSubmissionResponse> {
  const cleanBrokerage = encodeURIComponent(brokerageIdentifier.trim().toLowerCase())
  const cleanSlug = encodeURIComponent(slug.trim().toLowerCase())

  const res = await publicApiClient.post<PublicSubmissionResponse>(
    `/forms/public/${cleanBrokerage}/${cleanSlug}/submit`,
    payload,
  )

  return res.data
}

export const publicFormApi = {
  getPublicForm,
  submitPublicForm,
}

/**
 * TanStack query hook for loading public form definition.
 */
export function usePublicForm(brokerageIdentifier?: string, slug?: string) {
  return useQuery({
    queryKey: publicFormQueryKeys.detail(brokerageIdentifier || '', slug || ''),
    queryFn: () => publicFormApi.getPublicForm(brokerageIdentifier!, slug!),
    enabled: Boolean(brokerageIdentifier && slug),
    retry: (failureCount, error) => {
      // Do not retry 404 (Not Found) or 429 (Rate Limit Exceeded)
      if (
        axios.isAxiosError(error) &&
        (error.response?.status === 404 || error.response?.status === 429)
      ) {
        return false
      }
      return failureCount < 1
    },
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * TanStack mutation hook for submitting public form responses.
 */
export function useSubmitPublicForm(brokerageIdentifier: string, slug: string) {
  return useMutation({
    mutationFn: (payload: PublicFormSubmissionPayload) =>
      publicFormApi.submitPublicForm(brokerageIdentifier, slug, payload),
  })
}
