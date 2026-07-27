import React from 'react';
import { Amount } from '@signumjs/util';
import { CharacterCreationCostsPlanck } from '@lib/character/constants';
import type { UploadedAvatar } from './AvatarStep';

interface ReviewStepProps {
    name: string;
    description: string;
    avatar: UploadedAvatar;
    signaBalance: number;
    onConfirm: () => void;
    onBack: () => void;
}

const NETWORK_FEE_ESTIMATE_SIGNA = 1.02; // deploy fee (1) + funding fee (0.02), matches useCharacterCreation/useCharacterFunding

export const ReviewStep: React.FC<ReviewStepProps> = ({ name, description, avatar, signaBalance, onConfirm, onBack }) => {
    const rechargeSigna = parseFloat(Amount.fromPlanck(CharacterCreationCostsPlanck).getSigna());
    const totalRequired = rechargeSigna + NETWORK_FEE_ESTIMATE_SIGNA;
    const insufficientFunds = totalRequired > signaBalance;

    return (
        <div className="glass-static overflow-hidden p-5">
            <img src={avatar.url} alt={name} className="w-24 h-24 rounded-full object-cover mx-auto mb-4" />
            <h3 className="text-center text-[var(--text)] mb-1">{name}</h3>
            <p className="text-center text-[0.8rem] text-[var(--text-dim)] mb-4">{description}</p>

            <div className="mb-4 py-2.5 px-3 rounded-sm text-[0.75rem]" style={{ background: 'rgba(197,164,78,0.04)', border: '1px solid rgba(197,164,78,0.12)' }}>
                <p className="m-0">Character recharge: {rechargeSigna} SIGNA</p>
                <p className="m-0">Estimated network fees: {NETWORK_FEE_ESTIMATE_SIGNA} SIGNA</p>
                <p className="m-0 font-semibold">Total: {totalRequired.toFixed(2)} SIGNA</p>
            </div>

            {insufficientFunds && (
                <div className="mb-4 py-2.5 px-3 rounded-sm text-[0.8rem]" style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                    Insufficient balance. You have {signaBalance.toFixed(2)} SIGNA, need {totalRequired.toFixed(2)} SIGNA.
                </div>
            )}

            <button
                className="w-full py-3 border-none rounded-sm text-white text-[0.85rem] font-semibold uppercase tracking-[0.12em] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed mb-2"
                style={{ background: 'linear-gradient(135deg, var(--ember), #c44a2a)' }}
                disabled={insufficientFunds}
                onClick={onConfirm}
            >
                Create Character
            </button>
            <button className="w-full text-[0.75rem] underline text-[var(--text-dim)] bg-transparent border-none cursor-pointer" onClick={onBack}>
                Back
            </button>
        </div>
    );
};

export default ReviewStep;
