/* eslint no-await-in-loop: 0,  no-console: 0, no-unused-vars: 0 */

import _ from 'lodash';
import inquirer from 'inquirer';
import ecc from 'eosjs-ecc';
import bs58 from 'bs58';
import EOS from './eos';

const eosHelper = new EOS({ eosNetwork: 'https://proxy.eosnode.tools' });

const NUM_TRX_SCAN = 5;

function regenerateRoll({ sig, seed }) {
  const recoverKey = ecc.recoverHash(sig, Buffer.from(seed, 'hex'));

  const tempSig = sig.substring(7);
  const bytes = bs58.decode(tempSig);
  let bytesStr = bytes.toString('hex');
  bytesStr = bytesStr.substring(0, bytesStr.length - 8);
  bytesStr = `00${bytesStr}`;

  const hash = ecc.sha256(Buffer.from(bytesStr, 'hex'));

  let rand = 0;
  for (let j = 0; j <= 14; j += 2) {
    rand += parseInt(hash.substring(j, j + 2), 16);
  }

  rand = (rand % 100) + 1;

  return rand;
}


const questionsAccount = [
  {
    type: 'input',
    name: 'account',
    message: 'What is your eos account name?',
  },
];

let betReceipts = [];

function ask() {
  console.log('Welcome to BETX fairness verification');
  inquirer.prompt(questionsAccount).then(async (answers) => {
    console.log(answers.account);
    const { account } = answers;
    const latestSeq = await eosHelper.getLatestActionSeq(account);


    let currentPos = latestSeq;
    const step = -500;
    let results;

    do {
    // Query betreceipt from get actions
      results = await eosHelper.queryBetReceipts({
        name: account,
        pos: currentPos,
        offset: step,
      });

      // Add found receipts to array
      betReceipts = _.concat(betReceipts, results);
      currentPos += step;
    } while (!_.isEmpty(results) && betReceipts.length < NUM_TRX_SCAN);

    console.log(`Found ${betReceipts.length} betreceipt for account ${account}, and only display recent ${NUM_TRX_SCAN} entries`);

    betReceipts = betReceipts.slice(0, NUM_TRX_SCAN);

    return inquirer.prompt([
      {
        type: 'list',
        name: 'betId',
        message: 'Which Bet Id do you want to test?',
        choices: _.map(betReceipts, receipt => receipt.betId),
      }]);
  }).then(async (answers) => {
    const { betId } = answers;

    const receiptObj = _.find(betReceipts, { betId });

    console.log(`Bet Id ${betId}'s seed: ${receiptObj.seed}, signature: ${receiptObj.signature}, original roll: ${receiptObj.roll}`);
    console.log('Now we are re-calculating random roll with seed and signature, and prove the result same as the original roll.');

    const roll = regenerateRoll({ sig: receiptObj.signature, seed: receiptObj.seed });
    console.log(`The roll generated is ${roll}`);
    if (roll === receiptObj.roll) {
      console.log('Success! The roll equals to the origial number. ');
    } else {
      console.error('Failed! The roll does not equal to the original number. ');
    }

    console.log("Bye!");
  });
}

ask();
