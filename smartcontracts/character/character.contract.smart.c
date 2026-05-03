#program name Character
#program description This is the character template contract for the SignaRank RPG
#program activationAmount 200000000
#pragma optimizationLevel 2
#pragma verboseAssembly false
#pragma maxAuxVars 3
#pragma version 2.3.0


 long isDead;
 long hitpoints;
 long maxHitpoints;

// basic tx iteration struct
struct TX {
    long txId;
    long sender;
    long height;
    long assetIds[4];
    long message[4];
} currentTx;

long messageBuffer[4];
long eventBuffer[4];
long ZERO;
const ZERO = 0;

init();

void init(){
    maxHitpoints = calcMaxHitpoint();
    hitpoints = maxHitpoints
    isDead = ZERO;
}

// TODO: implementation

void main() {


    currentTx.height =  getCurrentBlockheight();

    while ((currentTx.txId = getNextTx()) != ZERO) {
        currentTx.sender = getSender(currentTx.txId);
        readMessage(currentTx.txId, 0, currentTx.message);
        readAssets(currentTx.txId, currentTx.assetIds);
            switch(currentTx.message[0]) {
                case SETACTIVE:
                    setActive(currentTx.message[1]);
                break;
            }
        }
    }
}

long calcMaxHitpoint() {
    // How to calculation Hitpoints?
}
