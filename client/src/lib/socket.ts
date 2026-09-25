import * as React from 'react'
import { io, Socket } from 'socket.io-client'
import { getAccessToken } from './api'

let socketInstance: Socket | null = null

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io('/', {
      path: '/socket.io',
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: (cb) => {
        const token = getAccessToken()
        cb({ token })
      },
    })
  }
  return socketInstance
}

export function connectSocket(): Socket {
  const socket = getSocket()
  if (!socket.connected) {
    socket.connect()
  }
  return socket
}

export function disconnectSocket(): void {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
}

/**
 * Reusable hook to subscribe to a Socket.IO event safely with automatic cleanup.
 */
export function useSocketEvent<T>(
  eventName: string,
  handler: (data: T) => void,
  enabled: boolean = true,
): void {
  const handlerRef = React.useRef(handler)
  handlerRef.current = handler

  React.useEffect(() => {
    if (!enabled) return

    const socket = connectSocket()

    const eventListener = (data: T) => {
      handlerRef.current(data)
    }

    socket.on(eventName, eventListener)

    return () => {
      socket.off(eventName, eventListener)
    }
  }, [eventName, enabled])
}
