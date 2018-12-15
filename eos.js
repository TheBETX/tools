import _ from 'lodash';

const { JsonRpc } = require('eosjs');
const fetch = require('node-fetch'); // node only; not needed in browsers

class eosHelper {
  constructor({ eosNetwork }) {
    this.rpc = new JsonRpc(eosNetwork, { fetch });

    this.getActions = this.getActions.bind(this);
    this.getLatestActionSeq = this.getLatestActionSeq.bind(this);
    this.queryBetReceipts = this.queryBetReceipts.bind(this);
  }

  getActions(name, pos, offset) {
    const { rpc } = this;

    return rpc.history_get_actions(
      name,
      pos, // pos; -1 equals to latest
      offset, // number of entry
    );
  }

  async getLatestActionSeq(name) {
    const { getActions } = this;
    const results = await getActions(name, -1, -1);

    if (_.isEmpty(results.actions)) {
      throw new Error('[getLatestActionSeq]: results of -1 -1 is empty!');
    }

    return results.actions[0].account_action_seq;
  }

  async queryBetReceipts(params) {
    const {
      name, pos, offset,
    } = params;

    const { getActions } = this;

    const actionResults = await getActions(name, pos, offset);
    const filteredActions = _.uniqBy(
      _.filter(
        _.map(actionResults.actions, (action) => {
          const { action_trace: { act } } = action;

          // Skip an action is it's later than start
          if (act.name === 'betreceipt' && act.account === 'thebetxowner' && _.find(act.authorization, { actor: 'thebetxowner' })) {
            return action;
          }

          return undefined;
        }),
        o => o,
      ),
      'action_trace.trx_id',
    );

    // Convert actions entries to our database format
    return _.map(filteredActions, (action) => {
      const {
        bet_id: betId, random_roll: roll, seed, signature, transferTx,
      } = action.action_trace.act.data;

      return {
        betId,
        roll,
        seed,
        signature,
        transferTx,
        time: action.action_trace.block_time,
        blockNum: action.action_trace.block_num,
        txId: action.action_trace.trx_id,
      };
    });
  }
}

export default eosHelper;
