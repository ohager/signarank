import styles from './button.module.scss'
import {MouseEventHandler} from 'react';

interface Props {
    onClick: MouseEventHandler;
    label: string;
}

export const Button: React.FC<Props> = ({onClick, label}) => {
    return <button className={styles.button} onClick={onClick}>{label}</button>
}
