import {ComponentProps} from 'react';

interface Props extends ComponentProps<"input"> {}

export const TextField: React.FC<Props> = (props) => {
    return (
        <input
            className="w-full py-3.5 px-4 bg-[rgba(0,0,0,0.4)] border border-[var(--glass-border)] text-[var(--text)] rounded-sm outline-none transition-[border-color] duration-300 text-[0.85rem] focus:border-[var(--gold-dim)] placeholder:text-[var(--text-faint)]"
            style={{fontFamily: "'IBM Plex Mono', monospace"}}
            {...props}
        />
    )
}
