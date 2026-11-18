import { useEffect, useState } from 'preact/hooks'

export type Route = { parts: string[]; query: URLSearchParams }

function parse(): Route {
  const raw = location.hash.replace(/^#\/?/, '')
  const [path, qs] = raw.split('?')
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(qs ?? '') }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse)
  useEffect(() => {
    const on = () => {
      setRoute(parse())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export function go(path: string) {
  location.hash = path.startsWith('#') ? path : `#${path}`
}
