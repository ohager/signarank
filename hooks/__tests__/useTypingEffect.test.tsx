// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTypingEffect } from '../useTypingEffect';

describe('useTypingEffect', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns empty string initially', () => {
        const { result } = renderHook(() => useTypingEffect('hello'));
        expect(result.current).toBe('');
    });

    it('returns empty string when text is null', () => {
        const { result } = renderHook(() => useTypingEffect(null));
        expect(result.current).toBe('');
    });

    it('reveals one character per interval tick', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useTypingEffect('hi', 30));

        act(() => { vi.advanceTimersByTime(30); });
        expect(result.current).toBe('h');

        act(() => { vi.advanceTimersByTime(30); });
        expect(result.current).toBe('hi');
    });

    it('stops at the full text length', () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useTypingEffect('ab', 30));

        act(() => { vi.advanceTimersByTime(9999); });
        expect(result.current).toBe('ab');
    });

    it('resets to empty when text changes', () => {
        vi.useFakeTimers();
        const { result, rerender } = renderHook(
            ({ text }: { text: string }) => useTypingEffect(text, 30),
            { initialProps: { text: 'abc' } }
        );

        act(() => { vi.advanceTimersByTime(60); });
        expect(result.current).toBe('ab');

        rerender({ text: 'xyz' });
        expect(result.current).toBe('');
    });

    it('clears the interval on unmount', () => {
        vi.useFakeTimers();
        const clearSpy = vi.spyOn(globalThis, 'clearInterval');
        const { unmount } = renderHook(() => useTypingEffect('hello', 30));
        unmount();
        expect(clearSpy).toHaveBeenCalled();
    });
});
