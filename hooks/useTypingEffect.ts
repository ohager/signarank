import { useState, useEffect } from 'react';

export function useTypingEffect(text: string | null, charInterval = 30): string {
    const [displayed, setDisplayed] = useState('');

    useEffect(() => {
        if (!text) {
            setDisplayed('');
            return;
        }
        setDisplayed('');
        let index = 0;
        const id = setInterval(() => {
            index += 1;
            setDisplayed(text.slice(0, index));
            if (index >= text.length) clearInterval(id);
        }, charInterval);
        return () => clearInterval(id);
    }, [text, charInterval]);

    return displayed;
}
