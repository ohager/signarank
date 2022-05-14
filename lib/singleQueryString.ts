export const singleQueryString = (q: string | string[] | undefined): string => {
    if (typeof (q) === 'string') return q
    if (Array.isArray(q) && q.length > 0) return q[0]
    return ""
}
