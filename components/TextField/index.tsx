import styles from './textfield.module.scss'
import {ComponentProps} from 'react';

interface Props extends ComponentProps<"input"> {}

export const TextField: React.FC<Props> = (props) => {
    return <input className={styles.textfield} {...props}/>
}
