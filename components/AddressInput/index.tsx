import {ChangeEventHandler, KeyboardEvent} from 'react';
import {TextField} from '@components/TextField';

interface Props {
    onChange: ChangeEventHandler<HTMLInputElement>,
    onEnter?: Function,
    value: string;
}

export const AddressInput: React.FC<Props> = ({onChange, onEnter, value}) => {
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if(onEnter && e.key === 'Enter') {
            onEnter()
        }
    }

    return (
        <TextField placeholder="Enter Address, or Id" onChange={onChange} value={value} onKeyDown={handleKeyDown} />
    )
}
