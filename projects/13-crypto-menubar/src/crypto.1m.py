#!/usr/bin/python3
# <xbar.title>Crypto price</xbar.title>
# <xbar.desc>Курс монет в рублях: биржевая цена к USDT × курс USDT/RUB, как считает Walt. Монету для строки меню выбирают в меню.</xbar.desc>
# <swiftbar.hideAbout>true</swiftbar.hideAbout>
# <swiftbar.hideRunInTerminal>true</swiftbar.hideRunInTerminal>
# <swiftbar.hideDisablePlugin>true</swiftbar.hideDisablePlugin>

import json
import os
import sys
import urllib.request
from datetime import datetime

# монета → тикер к USDT (Bybit пишет слитно, OKX через дефис)
COINS = {"Gram": "GRAM", "Bitcoin": "BTC", "Ethereum": "ETH"}
DEFAULT_COIN = "Gram"
# валюта → (символ, название в меню)
CURRENCIES = {"RUB": ("₽", "Рубли"), "USD": ("$", "Доллары")}
DEFAULT_CURRENCY = "RUB"

BYBIT_URL = "https://api.bybit.com/v5/market/tickers?category=spot&symbol={}USDT"
OKX_URL = "https://www.okx.com/api/v5/market/ticker?instId={}-USDT"
USDT_RUB_URL = "https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub"
SELF = os.path.abspath(__file__)
OPEN_WALT = os.path.expanduser("~/Library/Application Support/SwiftBar/open-walt.sh")
SELECTED_FILE = os.path.expanduser("~/Library/Application Support/SwiftBar/crypto-selected.txt")
CURRENCY_FILE = os.path.expanduser("~/Library/Application Support/SwiftBar/crypto-currency.txt")
RATE_CACHE = os.path.expanduser("~/Library/Caches/swiftbar-gram-usdt-rub.txt")
TIMEOUT_SEC = 8
UP_COLOR = "#34C759"
DOWN_COLOR = "#FF3B30"
BIG_PRICE = 1000  # от этой цены копейки в строке меню не показываем


def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "swiftbar-crypto"})
    with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as resp:
        return json.load(resp)


def from_bybit(ticker):
    t = fetch_json(BYBIT_URL.format(ticker))["result"]["list"][0]
    return float(t["lastPrice"]), float(t["price24hPcnt"]) * 100


def from_okx(ticker):
    t = fetch_json(OKX_URL.format(ticker))["data"][0]
    last, open24 = float(t["last"]), float(t["open24h"])
    return last, (last / open24 - 1) * 100


def coin_quote(ticker):
    errors = []
    for source in (from_bybit, from_okx):
        try:
            return source(ticker), None
        except Exception as exc:  # сеть, лимиты API, смена формата
            errors.append(f"{source.__name__}: {exc}")
    return None, "; ".join(errors)


def usdt_rub():
    # CoinGecko иногда отвечает 429 — тогда берём последний удачный курс из кэша
    try:
        rate = float(fetch_json(USDT_RUB_URL)["tether"]["rub"])
    except Exception:
        with open(RATE_CACHE) as f:
            return float(f.read())
    with open(RATE_CACHE, "w") as f:
        f.write(str(rate))
    return rate


def read_choice(path, allowed, default):
    try:
        with open(path) as f:
            value = f.read().strip()
    except OSError:
        return default
    return value if value in allowed else default


def ru_num(value, digits=2):
    return f"{value:,.{digits}f}".replace(",", " ").replace(".", ",")


def money(value, currency, compact=False):
    # compact — для строки меню: у крупных цен без копеек, рубли без знака ₽
    if compact and value >= BIG_PRICE:
        digits = 0
    elif currency == "USD" and value < 10:
        digits = 3
    else:
        digits = 2
    text = ru_num(value, digits)
    if currency == "USD":
        return f"${text}"
    return text if compact else f"{text} ₽"


def arrow(pct):
    return "▲" if pct >= 0 else "▼"


def main():
    # клики в меню запускают плагин с аргументами: select <монета> или currency <валюта>
    if len(sys.argv) == 3:
        command, value = sys.argv[1:]
        if command == "select" and value in COINS:
            with open(SELECTED_FILE, "w") as f:
                f.write(value)
        elif command == "currency" and value in CURRENCIES:
            with open(CURRENCY_FILE, "w") as f:
                f.write(value)
        return

    try:
        rate = usdt_rub()
    except Exception as exc:
        print("—")
        print("---")
        print(f"usdt_rub: {exc} | color={DOWN_COLOR} size=11")
        print("Обновить | refresh=true")
        return

    selected = read_choice(SELECTED_FILE, COINS, DEFAULT_COIN)
    currency = read_choice(CURRENCY_FILE, CURRENCIES, DEFAULT_CURRENCY)
    other = "USD" if currency == "RUB" else "RUB"
    to = {"RUB": rate, "USD": 1.0}  # множитель из USDT в валюту
    quotes = {name: coin_quote(ticker) for name, ticker in COINS.items()}

    quote, _ = quotes[selected]
    if quote is None:
        print("—")
    else:
        # левый клик по цифре открывает Walt, правый — это меню
        print(f'{money(quote[0] * to[currency], currency, compact=True)} | bash="{OPEN_WALT}" terminal=false')
    print("---")
    for name, (q, err) in quotes.items():
        mark = "✓ " if name == selected else "    "
        action = f'bash="{SELF}" param1=select param2={name} terminal=false refresh=true'
        if q is None:
            print(f"{mark}{name}: нет данных | {action} color={DOWN_COLOR}")
            print(f"--{err} | size=11")
            continue
        usd, pct = q
        color = UP_COLOR if pct >= 0 else DOWN_COLOR
        print(f"{mark}{name}: {money(usd * to[currency], currency)}  {arrow(pct)} {ru_num(abs(pct))}% | {action}")
        print(f"--{money(usd * to[other], other)}  ·  24ч {arrow(pct)} {ru_num(abs(pct))}% | color={color}")
    print("---")
    # у пункта без действия SwiftBar гасит и его подменю, поэтому клик сразу переключает валюту
    print(
        f"Валюта: {CURRENCIES[currency][0]} → {CURRENCIES[other][0]} | "
        f'bash="{SELF}" param1=currency param2={other} terminal=false refresh=true'
    )
    print(f'Открыть Walt | bash="{OPEN_WALT}" terminal=false')
    print("Обновить | refresh=true")
    print(f"USDT {ru_num(rate)} ₽ · Bybit + CoinGecko, {datetime.now():%H:%M:%S} | size=11 color=gray")


main()
