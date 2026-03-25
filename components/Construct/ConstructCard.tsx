import React from 'react';
import { ConstructData } from '@lib/construct/types';
import { useAttackerData } from '@hooks/useAttackerData';

interface ConstructCardProps {
    construct: ConstructData;
}

export const ConstructCard: React.FC<ConstructCardProps> = ({ construct }) => {
    const finalBlowAttacker = useAttackerData(construct.finalBlowAccount);
    const firstBloodAttacker = useAttackerData(construct.firstBloodAccount);
    const hpPercent = construct.currentHp / construct.maxHp;
    const hpColor = hpPercent > 0.5 ? '#4ade80' : hpPercent > 0.25 ? '#fbbf24' : '#ef4444';

    return (
        <div className="bg-black/60 rounded-2xl overflow-hidden border border-white/10 backdrop-blur-sm">
            <div className="relative w-full aspect-[2.5/1] overflow-hidden max-md:aspect-[2/1]">
                <img
                    src={construct.imageUrl}
                    alt={construct.name}
                    className="w-full h-full object-cover"
                />
                {construct.isDefeated && (
                    <div className="absolute inset-0 bg-black/70 flex justify-center items-center">
                        <span className="text-3xl font-bold text-red-500 uppercase tracking-[0.3rem] [text-shadow:0_0_20px_rgba(239,68,68,0.5)]">DEFEATED</span>
                    </div>
                )}
            </div>

            <div className="py-3 px-4">
                <h2 className="text-xl font-bold text-white m-0 mb-1 max-md:text-lg">{construct.name}</h2>
                <p className="text-white/70 m-0 mb-3 text-[0.8rem] leading-tight max-md:text-xs">{construct.description}</p>

                <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-white font-medium text-[0.85rem] max-md:text-[0.8rem]">
                            <span>HP</span>
                            <span>{construct.currentHp.toLocaleString()} / {construct.maxHp.toLocaleString()}</span>
                        </div>
                        <div className="h-4 bg-white/10 rounded-lg overflow-hidden max-md:h-3.5">
                            <div
                                className="h-full rounded-xl transition-all duration-300"
                                style={{
                                    width: `${hpPercent * 100}%`,
                                    backgroundColor: hpColor
                                }}
                            />
                        </div>
                    </div>

                    <div className="flex gap-6 flex-wrap max-md:gap-4">
                        <div className="flex flex-col gap-1">
                            <span className="text-[0.65rem] text-white/50 uppercase tracking-wide">Cooldown</span>
                            <span className="text-[0.85rem] text-white font-medium max-md:text-[0.8rem]">{construct.coolDownInBlocks} blocks</span>
                        </div>
                        <div className="flex flex-col gap-1">
                            <span className="text-[0.65rem] text-white/50 uppercase tracking-wide">Breach Limit</span>
                            <span className="text-[0.85rem] text-white font-medium max-md:text-[0.8rem]">{construct.breachLimit}%</span>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-2">
                        {construct.isActive ? (
                            <span className="py-1 px-3 rounded-full text-xs font-semibold uppercase bg-green-400/20 text-green-400 border border-green-400/30">Active</span>
                        ) : (
                            <span className="py-1 px-3 rounded-full text-xs font-semibold uppercase bg-gray-400/20 text-gray-400 border border-gray-400/30">Inactive</span>
                        )}
                        {construct.isDefeated && (
                            <span className="py-1 px-3 rounded-full text-xs font-semibold uppercase bg-red-500/20 text-red-500 border border-red-500/30">Defeated</span>
                        )}
                    </div>
                </div>

                {construct.isDefeated && finalBlowAttacker && (
                    <div className="mt-4 pt-4 border-t border-white/10 text-white/70 text-[0.9rem] [&_p]:my-1">
                        <p>Final Blow: {finalBlowAttacker.attacker ? `[${finalBlowAttacker.attackerName}] ` : ''}
                            {finalBlowAttacker.attacker} ({finalBlowAttacker.attackerXp} XP)
                        </p>
                        {firstBloodAttacker && (
                            <p>First Blood: {firstBloodAttacker.attacker ? `[${firstBloodAttacker.attackerName}] ` : ''}
                                {firstBloodAttacker.attacker} ({firstBloodAttacker.attackerXp} XP)</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConstructCard;
