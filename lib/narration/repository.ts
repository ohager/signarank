import { prisma } from '@lib/prisma';

export async function findNarrations(params: {
    seasonName: string;
    constructName: string;
    locale: string;
}) {
    return prisma.attackNarration.findMany({
        where: {
            seasonName: params.seasonName,
            constructName: params.constructName,
            locale: params.locale,
        },
    });
}
