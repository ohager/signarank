import {MouseEventHandler} from 'react';

interface Props {
    onClick: MouseEventHandler;
    label: string;
}

export const Button: React.FC<Props> = ({onClick, label}) => {
    return (
        <button
            className="px-6 py-2.5 bg-transparent text-[var(--gold)] border border-[var(--gold-dim)] rounded-sm text-[0.7rem] font-semibold tracking-[0.12em] uppercase transition-all duration-300 hover:bg-[var(--gold)] hover:text-[#080610] hover:shadow-[0_0_30px_rgba(197,164,78,0.25)]"
            style={{fontFamily: "'Cinzel', serif"}}
            onClick={onClick}
        >
            {label}
        </button>
    )
}
