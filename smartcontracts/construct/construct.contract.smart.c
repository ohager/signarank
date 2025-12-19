#program name Construct
#program description This is the base contract to spawn Constructs
#program activationAmount 200000000
#pragma optimizationLevel 3
#pragma verboseAssembly false
#pragma maxAuxVars 4
#pragma version 2.3.0

// Magic codes for methods
#define SETACTIVE 1
#define SETBREACHLIMIT 2
#define SETDAMAGEMULTIPLIER 3
#define SETDAMAGEADDITION 4
#define SETREWARDNFT 5
#define SETREWARDDISTRIBUTION 6
#define SETBONI 7
#define SETDEBUFF 8
#define SETREGENERATION 9
#define HEAL 10
#define SETTOKENDECIMALS 11

// helper
#define MAP_SET_FLAG 1024
#define TRANSFER_NFT_METHOD_HASH 7174296962751784077
#define NFT_FEES_PLANCK 32000000

// Maps
#define MAP_DAMAGE_MULTIPLIER 1
#define MAP_DAMAGE_ADDITION 11
#define MAP_DAMAGE_TOKEN_LIMIT 12
#define MAP_ATTACKERS_LAST_ATTACK 2
#define MAP_ATTACKERS_DEBUFF 21
#define MAP_TOKEN_DECIMALS_INFO 3

// parameters - starts at index 4 - initializable
// required
long name; // max 8 characters
long xpTokenId; // need to receive the amount of maxHp in XP Token.
long maxHp;

// optional
long baseDamageRatio;
long breachLimit;
long firstBloodBonus;
long finalBlowBonus;
long coolDownInBlocks;
long isActive;
long rewardNftId;

// Structs
struct REWARDDISTRIBUTION {
    long players;
    long treasury;
    // burn is implicit the rest
} rewardDistribution;

struct DEBUFF {
    long chance;
    long damageReduction;
    long maxStack;
} debuff;

struct REGENERATION {
    long blockInterval;
    long hitpoints;
    long lastRegenerationBlock;
} regeneration;

// Define initializer values if running on testbed
#ifdef TESTBED
    const name = TESTBED_name;
    const xpTokenId = TESTBED_xpTokenId;
    const maxHp = TESTBED_maxHp;
    const breachLimit = TESTBED_breachLimit;
    const coolDownInBlocks = TESTBED_coolDownInBlocks;
    const firstBloodBonus = TESTBED_firstBloodBonus;
    const finalBlowBonus = TESTBED_finalBlowBonus;
#endif


// derived/calculated state - not intended for initialization
long isDefeated;
long firstBloodAccount;
long finalBlowAccount;
long hpTokenId;

// basic tx iteration struct
struct TX {
    long txId;
    long sender;
    long height;
    long assetIds[4];
    long message[4];
} currentTx;

init();

void init(){

    hpTokenId = issueAsset(name, "", 0);
    mintAsset(maxHp, hpTokenId);

    // set defaults
    if(baseDamageRatio <= 0){
        baseDamageRatio = 10; // dmg(x) = x SIGNA * (10/100)
    }
    if(breachLimit <= 0){
        breachLimit = 20; // percentage: max damage is 20% initial HP
    }
    if(firstBloodBonus <= 0){
        firstBloodBonus = 1000_0000_0000;
    }

    if(finalBlowBonus <= 0) {
        finalBlowBonus = 5000_0000_0000;
    }

    if(coolDownInBlocks <= 0) {
        coolDownInBlocks = 15;
    }

    if(rewardDistribution.players <= 0){
        rewardDistribution.players = 85;
        rewardDistribution.treasury = 5;
        // rest is burn => 10%%
    }
    // debuff is optional... all zero is fine

    isActive = 1;
    isDefeated = 0;
}

void main() {

    currentTx.height =  getCurrentBlockheight();

    while ((currentTx.txId = getNextTx()) != 0) {
        currentTx.sender = getSender(currentTx.txId);
        readMessage(currentTx.txId, 0, currentTx.message);
        readAssets(currentTx.txId, currentTx.assetIds);

        if(currentTx.sender != getCreator() && isActive==1 && isDefeated==0){
            runAttackerRound();
        }
        else {
            switch(currentTx.message[0]) {
                case SETACTIVE:
                    setActive(currentTx.message[1]);
                break;
                case SETBREACHLIMIT:
                    setBreachLimit(currentTx.message[1]);
                break;
                case SETDAMAGEMULTIPLIER:
                    setDamageMultiplier(currentTx.message[1], currentTx.message[2], currentTx.message[3]);
                break;
                case SETDAMAGEADDITION:
                    setDamageAddition(currentTx.message[1], currentTx.message[2], currentTx.message[3]);
                break;
                case SETREWARDNFT:
                    setRewardNft(currentTx.message[1]);
                break;
                case SETREWARDDISTRIBUTION:
                    setRewardDistribution(currentTx.message[1], currentTx.message[2]);
                break;
                case SETBONI:
                    setBoni(currentTx.message[1], currentTx.message[2]);
                break;
                case SETDEBUFF:
                    setDebuff(currentTx.message[1], currentTx.message[2], currentTx.message[3]);
                break;
                case SETREGENERATION:
                    setRegeneration(currentTx.message[1], currentTx.message[2]);
                break;
                case HEAL:
                    heal(currentTx.message[1]);
                break;
                case SETTOKENDECIMALS:
                    setTokenDecimals(currentTx.message[1], currentTx.message[2]);
                break;
            }
        }
    }

    if(isDefeated) {
        handleDefeat();
    } else {
        regenerate();
    }
}

void regenerate() {
    if(regeneration.blockInterval == 0 || regeneration.hitpoints == 0) { return; }

    if(regeneration.lastRegenerationBlock == 0){
        regeneration.lastRegenerationBlock = currentTx.height;
        return;
    }

    long elapsedBlocks = currentTx.height - regeneration.lastRegenerationBlock;

    // Calculate regen proportional to time (fractional cycles)
    long hitpointsToRegenerate = (elapsedBlocks * regeneration.hitpoints) / regeneration.blockInterval;

    if(hitpointsToRegenerate > 0){
        long currentHp = getCurrentHitpoints();
        if(currentHp < maxHp){
            long actualRegen = hitpointsToRegenerate;
            if(currentHp + actualRegen > maxHp){
                actualRegen = maxHp - currentHp;
            }
            mintAsset(actualRegen, hpTokenId);
        }
    }

    // Always update
    regeneration.lastRegenerationBlock = currentTx.height;
}


void runAttackerRound() {
    long breachLimitHit = 0;

    // 1. Check Cooldown
    if (!checkCooldown()) {
        return;
    }

    // 2. Calculate Damage
    long totalDamage = applyTokenModifiers(calculateSignaDamage());

    // 3. Apply Debuff
    long debuffStacks = getMapValue(MAP_ATTACKERS_DEBUFF, currentTx.sender);
    if (debuffStacks > 0) {
        totalDamage = applyDebuff(totalDamage, debuffStacks);
        // Reduce stack
        setMapValue(MAP_ATTACKERS_DEBUFF, currentTx.sender, debuffStacks - 1);
    }

    // 4. Apply Breach Limit
    long preBreachDamage = totalDamage;
    long effectiveDamage = applyBreachLimit(totalDamage);
    if (effectiveDamage < preBreachDamage) {
        breachLimitHit = 1;
    }

    // 6. Check if defeated
    long currentHP = getCurrentHitpoints();
    if (effectiveDamage >= currentHP) {
        isDefeated = 1;
        effectiveDamage = currentHP; // we cannot do more damage
    }

    // 6. Send XP Tokens to Attacker
    if(getAssetBalance(xpTokenId) < effectiveDamage){
        // send warning to creator
        long msg[4];
        msg[] = "Insufficient XP Tokens!";
        sendMessage(msg, getCreator());
    }
    sendQuantity(effectiveDamage, xpTokenId, currentTx.sender);
    sendQuantity(effectiveDamage, hpTokenId, currentTx.sender);

    // 7. Send Messages for important events

    // First Blood?
    if (firstBloodAccount == 0) {
        firstBloodAccount = currentTx.sender;
        sendMsgFirstBlood(firstBloodAccount);
    }

    // Breach Limit Hit?
    if (breachLimitHit && !isDefeated) {
        sendMsgBreachLimit(currentTx.sender);
    }

    // Counter Attack?
    if (shouldCounterAttack()) {
        executeCounterAttack(); // Sends counter attack message
    }

    // 8. Update Last Attack Block
    setMapValue(MAP_ATTACKERS_LAST_ATTACK, currentTx.sender, currentTx.height);
}

long checkCooldown() {
    long lastAttack = getMapValue(MAP_ATTACKERS_LAST_ATTACK, currentTx.sender);
    if (lastAttack > 0 && (currentTx.height - lastAttack) < coolDownInBlocks) {
        sendMsgCooldown(currentTx.sender);
        // Still in cooldown! Refund 90%, burn 10%
        long signaAmount = getAmount(currentTx.txId);
        long refundAmount = (signaAmount * 90) / 100;
        long burnAmount = signaAmount - refundAmount;

        // Refund SIGNA
        if (refundAmount > 0) {
            sendAmount(refundAmount, currentTx.sender);
        }

        // Burn
        if (burnAmount > 0) {
            sendAmount(burnAmount, 0); // Burn address
        }

        refundPowerUpsWithPenalty();
        return 0; // Failed cooldown check
    }

    return 1; // Passed
}

inline void refundPowerUpsWithPenalty() {
    long assets[4];
    long quantities[4];
    long count = 0;
    // Collect all sent assets
    for (long i = 1; i <= 4; i++) {
        long assetId = currentTx.assetIds[i];
        if (assetId == 0) break;

        long quantity = getQuantity(currentTx.txId, assetId);
        if (quantity > 0) {
            assets[count] = assetId;
            quantities[count] = quantity;
            count++;
        }
    }

    if (count == 0) return; // No power-ups sent

    // Pick ONE random to keep (penalty)
    long keepIndex = (getWeakRandomNumber() >> 1) % count;

    // Refund all EXCEPT the chosen one
    for (long j = 0; j < count; j++) {
        if (j != keepIndex) {
            sendQuantity(quantities[j], assets[j], currentTx.sender);
        }
        // else: kept as penalty
    }
}

inline long calculateSignaDamage() {
     //  1. long signa =getAmount(currentTx.txId) / 1_0000_0000;
     //  2. (signa * baseDamageRatio) / 100;
     // optimized:
    return (getAmount(currentTx.txId) * baseDamageRatio) / 100_0000_0000;
}

long applyDebuff(long damage, long stacks) {
    if (stacks <= 0) return damage;

    // Calculate total reduction
    long totalReduction = stacks * debuff.damageReduction;

    // Apply reduction (can be negative = buff!)
    long modifiedDamage = (damage * (100 - totalReduction)) / 100;

    // Ensure non-negative
    if (modifiedDamage < 0) modifiedDamage = 0;

    return modifiedDamage;
}

long applyTokenModifiers(long baseDamage) {
    long damage = baseDamage;
    long totalAddition = 0;

    // First pass: Apply all flat additions
    totalAddition += applyTokenAddition(currentTx.assetIds[0]);
    totalAddition += applyTokenAddition(currentTx.assetIds[1]);
    totalAddition += applyTokenAddition(currentTx.assetIds[2]);
    totalAddition += applyTokenAddition(currentTx.assetIds[3]);

    damage += totalAddition;

    // Second pass: Apply all multipliers
    damage = applyTokenMultiplier(damage, currentTx.assetIds[0]);
    damage = applyTokenMultiplier(damage, currentTx.assetIds[1]);
    damage = applyTokenMultiplier(damage, currentTx.assetIds[2]);
    damage = applyTokenMultiplier(damage, currentTx.assetIds[3]);

    return damage;
}

long applyTokenAddition(long tokenId) {
    long quantity = getQuantity(currentTx.txId, tokenId);
    if (quantity == 0) { return 0; }

    long addition = getMapValue(MAP_DAMAGE_ADDITION, tokenId);
    if (addition == 0) { return 0; }

    long tokenLimit = getMapValue(MAP_DAMAGE_TOKEN_LIMIT, tokenId);
    long decimals = getTokenDecimals(tokenId, 0); // do not send message

    // Apply token limit (convert to raw units with decimals)
    if (tokenLimit > 0) {
        long tokenLimitRaw = tokenLimit * pow10(decimals);
        if (quantity > tokenLimitRaw) {
            quantity = tokenLimitRaw;
        }
    }

    // Apply addition (stacks per token, supports fractional tokens)
    // Example: 2 tokens × 50 addition = 100 damage added
    // Example: 0.5 tokens × 50 addition = 25 damage added
    return (addition * quantity) / pow10(decimals);
}

long applyTokenMultiplier(long damage, long tokenId) {
    long quantity = getQuantity(currentTx.txId, tokenId);
    if (quantity == 0) { return damage; }

    long multiplier = getMapValue(MAP_DAMAGE_MULTIPLIER, tokenId);
    if (multiplier == 0) { return damage; }

    long tokenLimit = getMapValue(MAP_DAMAGE_TOKEN_LIMIT, tokenId);
    long decimals = getTokenDecimals(tokenId, 0); // do not send message

    // Apply token limit (convert to raw units with decimals)
    if (tokenLimit > 0) {
        long tokenLimitRaw = tokenLimit * pow10(decimals);
        if (quantity > tokenLimitRaw) {
            quantity = tokenLimitRaw;
        }
    }

    // Apply multiplier (stacks per token, supports fractional tokens)
    // Example: 2 tokens × 500 (5x multiplier) = 1000 / 100 = 10x total
    // Example: 0.5 tokens × 500 = 250 / 100 = 2.5x total
    return (damage * multiplier * quantity) / (100 * pow10(decimals));
}

// Helper function - optimized for decimals 0-6
long pow10(long exp) {
    switch(exp) {
        case 0: return 1;
        case 1: return 10;
        case 2: return 100;
        case 3: return 1000;
        case 4: return 10000;
        case 5: return 100000;
        case 6: return 1000000;
        default: return 1; // Should never happen since decimals are capped at 6
    }
}

long applyBreachLimit(long damage) {
    if (breachLimit <= 0) {
        return damage;
    }

    long maxDamage = (maxHp * breachLimit) / 100;
    if (damage > maxDamage) {
        return maxDamage;
    }

    return damage;
}

inline long shouldCounterAttack() {
    if (debuff.chance <= 0 || debuff.damageReduction == 0) return 0;

    long random = getWeakRandomNumber() % 100;
    return (random < debuff.chance);
}

void executeCounterAttack() {
    long currentStacks = getMapValue(MAP_ATTACKERS_DEBUFF, currentTx.sender);

    if (currentStacks < debuff.maxStack) {
        setMapValue(MAP_ATTACKERS_DEBUFF, currentTx.sender, currentStacks + 1);
        if(debuff.damageReduction < 0){
            sendMsgCounterBuff(currentTx.sender);
        }else{
            sendMsgCounterDebuff(currentTx.sender);
        }
    }
}

void handleDefeat() {
    long message[4];
    finalBlowAccount = currentTx.sender;
    sendMsgDefeated(getCreator());
    sendMsgVictory(finalBlowAccount);
    sendAmount(finalBlowBonus, finalBlowAccount);
    message[] = "First Blood Bonus";
    sendAmountAndMessage(firstBloodBonus, message, firstBloodAccount);

    // Send NFT if configured
    if (rewardNftId != 0) {
        message[0] = TRANSFER_NFT_METHOD_HASH;
        message[1] = finalBlowAccount;
        message[2] = 0;
        message[3] = 0;
        sendAmountAndMessage(NFT_FEES_PLANCK, message, rewardNftId);
    }


    // Distribute Rewards
    long totalSigna = getCurrentBalance();
    long treasuryShare = (totalSigna * rewardDistribution.treasury) / 100;
    if (treasuryShare > 0) {
        sendAmount(treasuryShare, getCreator());
    }

    long playersCount = getAssetHoldersCount(1, hpTokenId);
    long distributionCosts = playersCount * 10_0000;
    long playersShare = ((totalSigna * rewardDistribution.players) / 100) - distributionCosts;
    distributeToHolders(1, hpTokenId, playersShare, 0, 0);

    long burnShare = totalSigna - (playersShare + treasuryShare);
    sendAmount(burnShare, 0);
}

// ---- ONLY CREATOR CAN CALL THESE FUNCTIONS


void setActive(long active) {
    if(active != 0){
        active = 1;
    }
    isActive = active;
}

void setBreachLimit(long limit) {
    if(limit > 0 && limit <= 100){
        breachLimit = limit;
    }
}

void setDamageMultiplier(long tokenId, long multiplier, long tokenLimit) {
    // validate for registered token sends message on token decimals
    getTokenDecimals(tokenId, 1);

    if(multiplier > 0 && multiplier <= 1000) { // max 10x damage
        setMapValue(MAP_DAMAGE_MULTIPLIER, tokenId, multiplier);
    }

    if(tokenLimit >= 0) {
        setMapValue(MAP_DAMAGE_TOKEN_LIMIT, tokenId, tokenLimit);
    }
}

void setDamageAddition(long tokenId, long damageAddition, long tokenLimit) {
    // validate for registered token sends message on token decimals
    getTokenDecimals(tokenId, 1);

    if(damageAddition > 0) {
       setMapValue(MAP_DAMAGE_ADDITION, tokenId, damageAddition);
    }

    if(tokenLimit >= 0) {
        setMapValue(MAP_DAMAGE_TOKEN_LIMIT, tokenId, tokenLimit);
    }
}

void setRewardNft(long nftId) {
    long nftCreator = getCreatorOf(nftId);
    if(getCreatorOf(nftId) == 0){
        long msg[3];
        msg[] = "Nft does not exist";
        sendMessage(msg, getCreator());
        return;
    }
    rewardNftId = nftId;
}

void setRewardDistribution(long players, long treasury) {
    if(players + treasury <= 100){
        rewardDistribution.players = players;
        rewardDistribution.treasury = treasury;
    }
}

void setBoni(long firstBloodAmount, long finalBlowAmount) {
    if(firstBloodAmount >= 0){
        firstBloodBonus = firstBloodAmount;
    }
    if(finalBlowAmount >= 0){
        finalBlowBonus = finalBlowAmount;
    }
}


void setDebuff(long debuffChance, long damageReduction, long maxDebuffStack) {
    if(debuffChance >= 0) {
        debuff.chance = debuffChance;
    }

    // damage reduction can be negative...which is a buffing then!
    debuff.damageReduction = damageReduction;

    if(maxDebuffStack >= 0){
        debuff.maxStack = maxDebuffStack;
    }

}

void setRegeneration(long blockInterval, long hitpoints){
    if(blockInterval >= 0) {
        regeneration.blockInterval = blockInterval;
    }
    if(hitpoints >= 0 && hitpoints <= maxHp) {
        regeneration.hitpoints = hitpoints;
    }
}

void heal(long hitpoints){

    if(hitpoints <= 0) { return; }

    long currentHitpoints = getCurrentHitpoints();
    if(hitpoints + currentHitpoints > maxHp){
        mintAsset(maxHp - currentHitpoints, hpTokenId);
    }
    else {
        mintAsset(hitpoints, hpTokenId);
    }
    sendMsgHealer(getCreator());
}

void setTokenDecimals(long tokenId, long tokenDecimals){
    if(tokenDecimals >= 0 && tokenDecimals <= 6){
        // the getMapValue return 0 also for non registered tokens, but 0 can be a valid decimal value
        // we need to flag a set value, as we cannot rely solely on the value
        setMapValue(MAP_TOKEN_DECIMALS_INFO, tokenId, tokenDecimals + MAP_SET_FLAG);
    }
}

long getTokenDecimals(long tokenId, long shouldSendMessage){
    long tokenDecimals = getMapValue(MAP_TOKEN_DECIMALS_INFO, tokenId);
    if(tokenDecimals >= MAP_SET_FLAG){
        // Return only the decimal value (subtract the flag)
        return tokenDecimals - MAP_SET_FLAG;
    }
    if(shouldSendMessage != 0){
        long msg[4];
        msg[] = "Unregistered Token detected!";
        sendMessage(msg, getCreator());
    }
    return 0;
}

long getCurrentHitpoints(){
    return getAssetBalance(hpTokenId);
}

// ----- MESSAGE HELPERS


void sendMsgCooldown(long recipient) {
    long msg[12];
    msg[] = "COOLDOWN: Attack too soon! Wait a few blocks. Penalty applied.\n";
    sendMessage(msg, recipient);
    sendMessage(msg + 4, recipient);
    sendMessage(msg + 8, recipient);
}

void sendMsgFirstBlood(long recipient) {
    long msg[12];
    msg[] = "FIRST BLOOD! You struck first and claimed a bonus reward on defeat!\n";

    sendMessage(msg, recipient);
    sendMessage(msg + 4, recipient);
    sendMessage(msg + 8, recipient);
}

void sendMsgVictory(long recipient) {
    long msg[12];
    msg[] = "VICTORY! Construct defeated! You dealt the final blow. You got the bonus.\n";
    sendMessage(msg, recipient);
    sendMessage(msg + 4, recipient);
    sendMessage(msg + 8, recipient);
}

void sendMsgCounterDebuff(long recipient) {
    long msg[12];
    msg[] = "COUNTER ATTACK! Construct strikes back. Next attack reduced.\n";
    sendMessage(msg, recipient);
    sendMessage(msg + 4, recipient);
    sendMessage(msg + 8, recipient);
}

void sendMsgCounterBuff(long recipient) {
    long msg[8];
    msg[] = "BERSERK! Andrenaline Pure. Next attack is stronger.\n";
    sendMessage(msg, recipient);
    sendMessage(msg + 4, recipient);
}

void sendMsgBreachLimit(long recipient) {
    long msg[8];
    msg[] = "BREACH LIMIT: Construct armor absorbed excess damage!\n";
    sendMessage(msg, recipient);
    sendMessage(msg + 4, recipient);
}

void sendMsgHealer(long recipient) {
    long msg[8];
    msg[] = "HEALING: Construct recovered hitpoints!\n";
    sendMessage(msg, recipient);
    sendMessage(msg + 4, recipient);
}

void sendMsgDefeated(long recipient) {
    long msg[8];
    msg[] = "DEFEATED: Construct was defeated!\n";
    sendMessage(msg, recipient);
    sendMessage(msg + 4, recipient);
}
