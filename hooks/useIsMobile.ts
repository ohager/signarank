import {useState, useEffect} from 'react';

const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

export const useIsMobile = (): boolean => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        setIsMobile(mobileRegex.test(navigator.userAgent));
    }, []);

    return isMobile;
};
