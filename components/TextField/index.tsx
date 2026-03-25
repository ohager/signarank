import {ComponentProps} from 'react';

interface Props extends ComponentProps<"input"> {}

export const TextField: React.FC<Props> = (props) => {
    return <input className="bg-[#fefefe] text-[var(--main-color4)] rounded px-4 py-2 font-['Rubik',sans-serif] uppercase border border-[var(--main-color2)] text-sm w-full brightness-100 hover:brightness-[1.2] hover:transition-[filter] hover:duration-100 hover:ease-in-out" {...props}/>
}
