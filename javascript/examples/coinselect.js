const { address } = require('bitcoinjs-lib');

const TX_EMPTY_VIRTUAL_SIZE = ((4 + 4 + 1 + 1) * 4 + 1 + 1) / 4;

const TX_OUTPUT_BASE = 8 + 1;

const BLANK_OUTPUT_VBYTES = 32;

const TX_INPUT_BASE = 32 + 4 + 1 + 4;

const TX_TRADE_RELEASE_WITNESS_BYTES = 341;
const TX_STANDARD_P2SH_P2WPKH_WITNESS_BYTES = 108;
const TX_REF_P2SH_SEGWIT_STRIPPED = 35;

const TX_STANDARD_P2SH_SEGWIT_STRIPPED = 23;

const byteLength = (hexString) => hexString.length / 2;

function inputVirtualBytes(input) {
  let p2sh_stripped_base = TX_INPUT_BASE;
  let witnessBytes;
  if (input.tradeInstruction) {
    p2sh_stripped_base += TX_REF_P2SH_SEGWIT_STRIPPED;
    witnessBytes = TX_TRADE_RELEASE_WITNESS_BYTES;
  } else {
    p2sh_stripped_base += TX_STANDARD_P2SH_SEGWIT_STRIPPED;
    witnessBytes = TX_STANDARD_P2SH_P2WPKH_WITNESS_BYTES;
  }
  return (p2sh_stripped_base * 4 + witnessBytes) / 4;
}

function outputVirtualBytes(output) {
  const outputScript = address.toOutputScript(output.address).toString('hex');
  return TX_OUTPUT_BASE + byteLength(outputScript);
}

function transactionVirtualBytes(inputs, outputs) {
  return (
    TX_EMPTY_VIRTUAL_SIZE +
    inputs.reduce((a, x) => a + inputVirtualBytes(x), 0) +
    outputs.reduce((a, x) => a + outputVirtualBytes(x), 0)
  );
}

function dustThreshold(output, feeRate) {
  return Math.ceil(inputVirtualBytes({}) * feeRate);
}

function uintOrNaN(v) {
  if (!isFinite(v)) return NaN;
  if (v < 0) return NaN;
  return v;
}

function sumForgiving(range) {
  return range.reduce((a, x) => a + (isFinite(x.value) ? x.value : 0), 0);
}

function sumOrNaN(range) {
  return range.reduce((a, x) => a + uintOrNaN(x.value), 0);
}

function finalize(inputs, outputs, feeRate) {
  const bytesAccum = transactionVirtualBytes(inputs, outputs);
  const feeAfterExtraOutput = feeRate * (bytesAccum + BLANK_OUTPUT_VBYTES);
  const remainderAfterExtraOutput =
    sumOrNaN(inputs) - (sumOrNaN(outputs) + feeAfterExtraOutput);

  if (remainderAfterExtraOutput > dustThreshold({}, feeRate)) {
    outputs = outputs.concat({ value: remainderAfterExtraOutput });
  }

  const fee = sumOrNaN(inputs) - sumOrNaN(outputs);
  if (!isFinite(fee)) {
    return {
      fee: feeRate * bytesAccum,
      outputs: undefined,
      inputs: undefined,
    };
  }

  return {
    inputs,
    outputs,
    fee,
  };
}

function blackjack(utxos, outputs, feeRate) {
  if (!isFinite(uintOrNaN(feeRate))) {
    return {
      inputs: undefined,
      outputs: undefined,
      fee: undefined,
    };
  }

  let bytesAccum = transactionVirtualBytes([], outputs);

  let inAccum = 0;
  const inputs = [];
  const outAccum = sumOrNaN(outputs);
  const threshold = dustThreshold({}, feeRate);

  for (let i = 0; i < utxos.length; i += 1) {
    const input = utxos[i];
    const iBytes = inputVirtualBytes(input);
    const fee = feeRate * (bytesAccum + iBytes);
    const inputValue = uintOrNaN(input.value);

    if (inAccum + inputValue > outAccum + fee + threshold) continue;

    bytesAccum += iBytes;
    inAccum += inputValue;
    inputs.push(input);

    if (inAccum < outAccum + fee) continue;

    return finalize(inputs, outputs, feeRate);
  }
  return {
    fee: feeRate * bytesAccum,
    inputs: undefined,
    outputs: undefined,
  };
}

function accumulative(utxos, outputs, feeRate) {
  if (!isFinite(uintOrNaN(feeRate))) {
    return {
      inputs: undefined,
      outputs: undefined,
      fee: undefined,
    };
  }
  let bytesAccum = transactionVirtualBytes([], outputs);

  let inAccum = 0;
  const inputs = [];
  const outAccum = sumOrNaN(outputs);

  for (let i = 0; i < utxos.length; i += 1) {
    const utxo = utxos[i];
    const utxoBytes = inputVirtualBytes(utxo);
    const utxoFee = feeRate * utxoBytes;
    const utxoValue = uintOrNaN(utxo.value);

    if (utxoFee > utxo.value) {
      if (i === utxos.length - 1)
        return {
          fee: feeRate * (bytesAccum + utxoBytes),
          inputs: undefined,
          outputs: undefined,
        };
      continue;
    }

    bytesAccum += utxoBytes;
    inAccum += utxoValue;
    inputs.push(utxo);

    const fee = feeRate * bytesAccum;

    if (inAccum < outAccum + fee) continue;

    return finalize(inputs, outputs, feeRate);
  }
  return {
    fee: feeRate * bytesAccum,
    inputs: undefined,
    outputs: undefined,
  };
}

function split(utxos, outputs, feeRate) {
  if (!isFinite(uintOrNaN(feeRate))) {
    return {
      inputs: undefined,
      outputs: undefined,
      fee: undefined,
    };
  }

  const bytesAccum = transactionVirtualBytes(utxos, outputs);
  const fee = feeRate * bytesAccum;
  if (outputs.length === 0) {
    return {
      fee,
      inputs: undefined,
      outputs: undefined,
    };
  }

  const inAccum = sumOrNaN(utxos);
  const outAccum = sumForgiving(outputs);
  const remaining = inAccum - outAccum - fee - 1;
  if (!isFinite(remaining) || remaining < 0) {
    return {
      inputs: 'notEnoughForFee',
      outputs: null,
      fee: fee / 10,
    };
  }

  const unspecified = outputs.reduce((a, x) => a + !isFinite(x.value), 0);

  if (remaining === 0 && unspecified === 0) {
    return finalize(utxos, outputs, feeRate);
  }

  const splitOutputsCount = outputs.reduce((a, x) => a + !x.value, 0);
  const splitValue = Math.ceil(remaining / splitOutputsCount);

  if (
    !outputs.every(
      (x) => x.value !== undefined || splitValue > dustThreshold(x, feeRate)
    )
  ) {
    return {
      fee,
      inputs: undefined,
      outputs: undefined,
    };
  }

  const returnOutputs = outputs.map((x) => {
    if (x.value !== undefined) return x;

    const y = {};
    for (const k in x) y[k] = x[k];
    y['value'] = splitValue;
    return y;
  });
  return finalize(utxos, returnOutputs, feeRate);
}

function utxoScore(x, feeRate) {
  return x.value - feeRate * inputVirtualBytes(x);
}

function coinSelect(utxos, outputs, feeRate) {
  utxos = utxos.concat().sort((a, b) => utxoScore(b, feeRate) - utxoScore(a, feeRate));

  const base = blackjack(utxos, outputs, feeRate);
  if (base['inputs']) return base;

  return accumulative(utxos, outputs, feeRate);
}

module.exports = {
  coinSelect,
  split
};
