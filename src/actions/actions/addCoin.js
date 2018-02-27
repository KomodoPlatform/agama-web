import { ACTIVE_HANDLE } from '../storeType';
import { translate } from '../../translate/translate';
import Config from '../../config';
import appData from './appData';
import {
  triggerToaster,
  toggleAddcoinModal,
  getDexCoins,
  shepherdElectrumCoins,
} from '../actionCreators';
import {
  checkCoinType,
  checkAC,
} from '../../components/addcoin/payload';

function iguanaActiveHandleState(json) {
  return {
    type: ACTIVE_HANDLE,
    isLoggedIn: json.status === 'unlocked' ? true : false,
    handle: json,
  }
}

export function activeHandle() {
  return dispatch => {
    return dispatch(
      iguanaActiveHandleState(Config.mock.api.auth ? Config.mock.api.auth : {
        status: 'locked',
      })
    );
  }
}

export function shepherdElectrumAuth(seed) {
  return dispatch => {
    return fetch(`http://127.0.0.1:${Config.agamaPort}/shepherd/electrum/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        seed,
        iguana: true,
        token: Config.token,
      }),
    })
    .catch((error) => {
      console.log(error);
      dispatch(
        triggerToaster(
          'shepherdElectrumAuth',
          'Error',
          'error'
        )
      );
    })
    .then(response => response.json())
    .then(json => {
      if (json.msg !== 'error') {
        dispatch(activeHandle());
        dispatch(shepherdElectrumCoins());
      } else {
        dispatch(
          triggerToaster(
            translate('TOASTR.INCORRECT_WIF'),
            'Error',
            'error'
          )
        );
      }
    });
  }
}

export function shepherdElectrumAddCoin(coin) {
  return dispatch => {
    return dispatch(
      addCoinResult(coin, '0')
    );

    /*return fetch(`http://127.0.0.1:${Config.agamaPort}/shepherd/electrum/coins/add?coin=${coin}&token=${Config.token}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })
    .catch((error) => {
      console.log(error);
      dispatch(
        triggerToaster(
          'shepherdElectrumAddCoin',
          'Error',
          'error'
        )
      );
    })
    .then(response => response.json())
    .then(json => {
      dispatch(
        addCoinResult(coin, '0')
      );
    });*/
  }
}

export function addCoin(coin, mode, startupParams) {
  if (mode === 0 ||
      mode === '0') {
    return dispatch => {
      dispatch(shepherdElectrumAddCoin(coin));
    }
  } else {
    return dispatch => {
      dispatch(shepherdGetConfig(coin, '-1', startupParams));
    }
  }
}


export function shepherdHerd(coin, mode, path, startupParams) {
  let acData;
  let herdData = {
    'ac_name': coin,
    'ac_options': [
      '-daemon=0',
      '-server',
      `-ac_name=${coin}`,
      coin === 'BEER' || coin === 'PIZZA' ? '-addnode=24.54.206.138' : '-addnode=78.47.196.146',
    ],
  };

  if (coin === 'ZEC') {
    herdData = {
      'ac_name': 'zcashd',
      'ac_options': [
        '-daemon=0',
        '-server=1',
      ],
    };
  }

  if (coin === 'KMD') {
    herdData = {
      'ac_name': 'komodod',
      'ac_options': [
        '-daemon=0',
        '-addnode=78.47.196.146',
      ],
    };
  }

  if (startupParams) {
    herdData['ac_custom_param'] = startupParams.type;

    if (startupParams.value) {
      herdData['ac_custom_param_value'] = startupParams.value;
    }
  }

  // TODO: switch statement
  if (checkCoinType(coin) === 'crypto') {
    acData = startCrypto(
      path.result,
      coin,
      mode
    );
  }

  if (checkCoinType(coin) === 'currency_ac') {
    acData = startCurrencyAssetChain(
      path.result,
      coin,
      mode
    );
  }

  if (checkCoinType(coin) === 'ac') {
    const supply = startAssetChain(
      path.result,
      coin,
      mode,
      true
    );
    acData = startAssetChain(
      path.result,
      coin,
      mode
    );
    herdData.ac_options.push(`-ac_supply=${supply}`);
  }

  return dispatch => {
    let _herd;

    if (coin === 'CHIPS') {
      _herd = 'chipsd';
      herdData = {};
    } else {
      _herd = coin !== 'ZEC' ? 'komodod' : 'zcashd';
    }

    return fetch(`http://127.0.0.1:${Config.agamaPort}/shepherd/herd`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        herd: _herd,
        options: herdData,
        token: Config.token,
      }),
    })
    .catch((error) => {
      console.log(error);
      dispatch(
        triggerToaster(
          translate('FAILED_SHEPHERD_HERD'),
          translate('TOASTR.SERVICE_NOTIFICATION'),
          'error'
        )
      );
    })
    .then(handleErrors)
    .then((json) => {
      if (json) {
        dispatch(
          addCoinResult(coin, mode)
        );
      } else {
        dispatch(
          triggerToaster(
            translate('TOASTR.ERROR_STARTING_DAEMON', coin) + ' ' + translate('TOASTR.PORT_IS_TAKEN', acData),
            translate('TOASTR.SERVICE_NOTIFICATION'),
            'error',
            false
          )
        );
      }
    });
  }
}

export function addCoinResult(coin, mode) {
  const modeToValue = {
    '0': 'spv',
    '-1': 'native',
  };

  if (!appData.coins[coin]) {
    appData.coins.push(coin);
    appData.allcoins.spv.push(coin);
    appData.allcoins.total++;
  }

  console.warn(appData);

  return dispatch => {
    dispatch(
      triggerToaster(
        `${coin} ${translate('TOASTR.STARTED_IN')} ${modeToValue[mode].toUpperCase()} ${translate('TOASTR.MODE')}`,
        translate('TOASTR.COIN_NOTIFICATION'),
        'success'
      )
    );
    dispatch(toggleAddcoinModal(false, false));

    if (Number(mode) === 0) {
      dispatch(activeHandle());
      dispatch(shepherdElectrumCoins());
      dispatch(getDexCoins());

      /*setTimeout(() => {
        dispatch(activeHandle());
        dispatch(shepherdElectrumCoins());
        dispatch(getDexCoins());
      }, 500);
      setTimeout(() => {
        dispatch(activeHandle());
        dispatch(shepherdElectrumCoins());
        dispatch(getDexCoins());
      }, 1000);
      setTimeout(() => {
        dispatch(activeHandle());
        dispatch(shepherdElectrumCoins());
        dispatch(getDexCoins());
      }, 2000);*/
    }
  }
}