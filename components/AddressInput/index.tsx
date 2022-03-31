import {ChangeEventHandler, useMemo} from 'react';
import {TextField} from '@components/TextField';
import {useAddressPrefix} from '@hooks/useAddressPrefix';

interface Props {
    onChange: ChangeEventHandler<HTMLInputElement>,
    value: string;
}

export const AddressInput: React.FC<Props> = ({onChange, value}) => {
    const prefix = useAddressPrefix()

    // const prefixedValue = useMemo(() => {
    //     if(value.startsWith(prefix)){
    //         return value
    //     }
    //     return value.startsWith(`${prefix}-`) ? value : `${prefix}-`
    // }, [value, prefix])

    return (
        <TextField placeholder="Enter Address, Id, or Alias" onChange={onChange} value={value} />
    )
}
