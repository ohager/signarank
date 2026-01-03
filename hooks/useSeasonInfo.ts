import seasons from "lib/seasons.json"
import {useMemo} from "react";

export type SeasonInfo = {
    name: string;
    background: string;
    isCurrent: boolean;
}

export const useSeasonInfo = () => {
    return useMemo(() => {
        return Object.values(seasons).find( season => season.isCurrent) as SeasonInfo
    }, [])
}
