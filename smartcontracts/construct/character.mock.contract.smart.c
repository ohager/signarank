#program name CharMock
#program description Test-only character stand-in — publishes public stats into its map so the construct can read them via getExtMapValue.
#program activationAmount 1000_0000
#pragma maxAuxVars 3
#pragma optimizationLevel 2

// A minimal test double for a character attacker. Its codehash is registered as
// the trusted G_CHARACTER_HASH so the construct's senderIsCharacter() fires, and
// it writes arbitrary (key1, key2, value) entries into its own public map so
// tests can seed exact strength / luck / level values that the construct reads.
// This is NOT production code — it only exists to make cross-contract map reads
// deterministically testable.

struct TX {
    long txId;
    long message[4];
} currentTx;

void main() {
    while ((currentTx.txId = getNextTx()) != 0) {
        readMessage(currentTx.txId, 0, currentTx.message);
        // [key1, key2, value] — publish one public map entry. key1 == 0 is a
        // bare funding/activation tx and is ignored.
        if (currentTx.message[0] != 0) {
            setMapValue(currentTx.message[0], currentTx.message[1], currentTx.message[2]);
        }
    }
}
