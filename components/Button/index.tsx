import {MouseEventHandler} from 'react';

interface Props {
    onClick: MouseEventHandler;
    label: string;
}

export const Button: React.FC<Props> = ({onClick, label}) => {
    return <button className="bg-[var(--main-color3)] text-[var(--white)] rounded px-4 py-2 font-['Rubik',sans-serif] uppercase border-none text-sm cursor-pointer brightness-100 hover:brightness-[1.2] hover:transition-[filter] hover:duration-100 hover:ease-in-out" onClick={onClick}>{label}</button>
}
