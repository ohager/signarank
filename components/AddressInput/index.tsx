import {ChangeEventHandler, KeyboardEvent} from 'react';
import {TextField} from '@components/TextField';
import {useAddressPrefix} from '@hooks/useAddressPrefix';

interface Props {
    onChange: ChangeEventHandler<HTMLInputElement>,
    onEnter?: Function,
    value: string;
}

export const AddressInput: React.FC<Props> = ({onChange, onEnter, value}) => {
    const prefix = useAddressPrefix()

    // const prefixedValue = useMemo(() => {
    //     if(value.startsWith(prefix)){
    //         return value
    //     }
    //     return value.startsWith(`${prefix}-`) ? value : `${prefix}-`
    // }, [value, prefix])

    const handleKeyPress = (e: KeyboardEvent<HTMLInputElement>) => {
        if(onEnter && e.key === 'Enter') {
            onEnter()
        }
    }

    return (
        <TextField placeholder="Enter Address, Id, or Alias" onChange={onChange} value={value} onKeyPress={handleKeyPress} />
    )
}
