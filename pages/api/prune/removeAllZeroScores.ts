import {prisma} from '@lib/prisma';

export async function removeAllZeroScores() {
    return prisma.address.deleteMany({
        where: {
            score: {
                equals: 0
            }
        }
    })
}