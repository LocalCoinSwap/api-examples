const { encode, encodingLength } = require('bip174/src/lib/converter/varint');
const { Psbt, networks, payments, script } = require('bitcoinjs-lib');
const { Decimal } = require('decimal.js');
const { coinSelect, split } = require('./coinselect');
const { decryptMessageWithAccountKey } = require('./decryptMessageWithAccountKey');
const { BitcoinSigner } = require('./signer');

const BitcoinScript = script;

const accountKey = ''; // Secret account key associated with your account. You can find this at the time of exporting Mnemonic

function examplePrepareAndSignUtxo() {
  const fromAddress = ''; // Your primary non-custodial BTC address
  const pvtKey = ''; // Private key associated with the above address (remove the prefix `p2wpkh-p2sh:`)

  const destinationAddress = ''; // The address to which you want to send BTC
  const feeRate = 10; // Fee rate in sat/byte
  const sendMax = true;

  // Get the UTXOs from `/api/v2/trade-utxos/BTC/` endpoint
  // It's a list under `results` key in the json response
  const utxoList = [];

  const outputSet = [
    {
      address: destinationAddress,
    },
  ];

  const { signedTx, totalFee, outputList, realFeeRate } = prepareTransaction(
    feeRate,
    utxoList,
    fromAddress,
    outputSet,
    pvtKey,
    sendMax
  );
  console.log('outputList', outputList);
  console.log('Signed', signedTx);
  if (signedTx === 'noValidInputs') {
    console.log('No valid inputs');
    return;
  }

  const cost = outputList[0].value;
  const totalCost = cost + totalFee;

  console.log('Total cost', totalCost);
  console.log('Approx fee', totalFee);
  console.log('Real fee rate', realFeeRate);

  console.log("You're ready to broadcast the following transaction");
  console.log(signedTx);
}

function loadKey(privKeyString) {
  let privKey;
  if (privKeyString.split(':').length === 2) {
    privKey = new BitcoinSigner(privKeyString.split(':')[1]);
  } else {
    privKey = new BitcoinSigner(privKeyString);
  }
  return privKey;
}

function getSelectedInputsOutputs(
  feeLevel,
  utxoSet,
  changeAddress,
  outputSet,
  sendAll = false
) {
  const coinSelecter = sendAll ? split : coinSelect;

  let targets = outputSet;
  if (sendAll) {
    targets = [
      {
        address: outputSet[0].address,
      },
    ];
  }

  const utxos = [];
  utxoSet.forEach((utxo) => {
    utxos.push({
      txId: utxo.tx_hash,
      vout: utxo.tx_pos,
      value: utxo.value,
      tradeInstruction: utxo.tradeInstruction,
    });
  });
  const { inputs, outputs: outputList, fee } = coinSelecter(utxos, targets, feeLevel);

  if (!inputs || inputs === 'notEnoughForFee') {
    throw {
      name: 'NoValidInputs',
      message: 'No valid inputs returned by coin selector',
    };
  }

  const chosenInputHashes = [];
  inputs.forEach((input) => {
    chosenInputHashes.push({
      tx_hash: input.txId,
      tx_pos: input.vout,
    });
  });
  const inputList = utxoSet.filter((utxo) =>
    chosenInputHashes.find(
      (input) => input.tx_hash === utxo.tx_hash && input.tx_pos === utxo.tx_pos
    )
  );

  outputList.forEach((output) => {
    if (!output.address) {
      output.address = changeAddress;
      output.value = Math.floor(output.value);
    }
  });

  if (!inputList || !outputList) throw new Error('No inputs or outputs were found');
  return { inputList, outputList, totalFee: Math.ceil(fee) };
}

function buildTransaction(inputList, outputList, inputPubkey) {
  const network = networks.bitcoin;
  const psbt = new Psbt({ network });
  psbt.setVersion(2);
  psbt.setLocktime(0);

  inputList.forEach((input) => {
    const newInput = {
      hash: input.tx_hash,
      index: input.tx_pos,
      sequence: 0xffffffff - 2,
      nonWitnessUtxo: Buffer.from(input.prev_tx, 'hex'),
    };

    const p2wpkh = payments.p2wpkh({ pubkey: inputPubkey });
    let p2sh = payments.p2sh({ redeem: p2wpkh });
    newInput['redeemScript'] = p2sh.redeem.output;

    if (input.witnessScript) {
      const p2wsh = payments.p2wsh({
        redeem: {
          output: Buffer.from(input.witnessScript, 'hex'),
          network,
        },
        network,
      });
      p2sh = payments.p2sh({
        redeem: p2wsh,
        network,
      });
      newInput['redeemScript'] = p2sh.redeem.output;
      newInput['witnessScript'] = Buffer.from(input.witnessScript, 'hex');
    }
    psbt.addInput(newInput);
  });

  outputList.forEach((output) => {
    psbt.addOutput({
      address: output.address,
      value: output.value,
    });
  });

  return psbt;
}

function signTransaction(keypair, psbt) {
  psbt.signAllInputs(keypair);
  return psbt;
}

function finaliseTransaction(psbt, inputList, key) {
  inputList.forEach((input, index) => {
    if (!input.redeemScript && !input.witnessScript) {
      psbt.finalizeInput(index);
    }

    if (input.redeemScript || input.witnessScript) {
      psbt.finalizeInput(
        index,
        finaliseTradeInput({
          secret: decryptoUtxoSecret(input, key),
          instruction: input.tradeInstruction,
        })
      );
    }
  });
  const realFeeRate = psbt.getFeeRate();
  return { signedTx: psbt.extractTransaction().toHex(), realFeeRate };
}

function decryptoUtxoSecret(input, key) {
  if (input.tradeSecret) {
    return input.tradeSecret;
  }
  if (input.trade_secret_enc && !key) {
    const tradeSecret = decryptMessageWithAccountKey(input.trade_secret_enc, accountKey);
    return tradeSecret;
  }
  if (input.trade_secret_enc && key) {
    return decryptMessageWithAccountKey(input.trade_secret_enc, key);
  }
  return 'FeeWithdrawal';
}

function finaliseTradeInput({ secret, instruction }) {
  return function (inputIndex, input, script, isSegwit, isP2SH, isP2WSH) {
    let payment;
    if (secret === 'FeeWithdrawal') {
      payment = {
        output: script,
        input: BitcoinScript.compile([
          input.partialSig[0].signature,
          input.partialSig[0].pubkey,
        ]),
      };
    } else {
      payment = {
        output: script,
        input: BitcoinScript.compile([
          input.partialSig[0].signature,
          input.partialSig[0].pubkey,
          Buffer.from(secret, 'hex'),
          Buffer.from(instruction, 'hex'),
        ]),
      };
    }

    if (isP2WSH && isSegwit) {
      payment = payments.p2wsh({
        redeem: payment,
      });
    }
    if (isP2SH) {
      payment = payments.p2sh({
        redeem: payment,
      });
    }

    return {
      finalScriptSig: payment.input,
      finalScriptWitness: payment.witness && payment.witness.length > 0 ? witnessStackToScriptWitness(payment.witness) : undefined,
    };
  };
}

function witnessStackToScriptWitness(witness) {
  let buffer = Buffer.allocUnsafe(0);

  function writeSlice(slice) {
    buffer = Buffer.concat([buffer, Buffer.from(slice)]);
  }
  function writeVarInt(i) {
    const currentLen = buffer.length;
    const varintLen = encodingLength(i);
    buffer = Buffer.concat([buffer, Buffer.allocUnsafe(varintLen)]);
    encode(i, buffer, currentLen);
  }
  function writeVarSlice(slice) {
    writeVarInt(slice.length);
    writeSlice(slice);
  }
  function writeVector(vector) {
    writeVarInt(vector.length);
    vector.forEach(writeVarSlice);
  }
  writeVector(witness);
  return buffer;
}

function prepareTransaction(feeLevel, utxoSet, changeAddress, outputSet, privkeyWIF, sendAll = false) {
  let inputList;
  let outputList;
  let totalFee;
  try {
    ({ inputList, outputList, totalFee } = getSelectedInputsOutputs(new Decimal(feeLevel), utxoSet, changeAddress, outputSet, sendAll));
  } catch (err) {
    if (err.name === 'NoValidInputs') {
      return { signedTx: 'noValidInputs', totalFee: 0, outputList: [] };
    }
    throw err;
  }
  const keypair = loadKey(privkeyWIF);
  const psbt = buildTransaction(inputList, outputList, keypair.publicKey);
  const signedPsbt = signTransaction(keypair, psbt);
  const { signedTx, realFeeRate } = finaliseTransaction(signedPsbt, inputList, undefined);
  return { signedTx: signedTx, totalFee, outputList, realFeeRate };
}

module.exports = {
  examplePrepareAndSignUtxo,
};
