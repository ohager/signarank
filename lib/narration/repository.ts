import { prisma } from '@lib/prisma';

const BASE_SELECT = { id: true, text: true, tags: true } as const;

export async function findNarrations(params: {
    seasonName: string;
    constructName: string;
    locale: string;
    tags: string[];
}) {
    const { seasonName, constructName, locale, tags } = params;
    const base = { seasonName, constructName, locale };

    if (tags.length > 0) {
        const matches = await prisma.attackNarration.findMany({
            where: { ...base, tags: { hasSome: tags } },
            select: BASE_SELECT,
        });
        if (matches.length > 0) return matches;
    }

    return prisma.attackNarration.findMany({
        where: base,
        select: BASE_SELECT,
    });
}
