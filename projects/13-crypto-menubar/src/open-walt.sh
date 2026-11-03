#!/bin/bash
# Показывает Walt: если окно уже открыто — выводит его вперёд, иначе открывает.
# Каждое повторное открытие ссылки добавляет в окно Walt ещё одну вкладку, поэтому
# лишний раз ссылку не открываем. Окно мини-приложения для macOS безымянное,
# главное окно называется «Telegram @ …». Нужен «Универсальный доступ» для SwiftBar.

WALT_URL="tg://resolve?domain=wallet&appname=start"
LOG="$HOME/Library/Logs/open-walt.log"

result=$(osascript <<'EOF' 2>&1
tell application "System Events"
    if not (exists process "Telegram") then return "нет Telegram"
    tell process "Telegram"
        set report to ""
        repeat with w in (every window)
            set {wd, ht} to size of w
            set report to report & " [" & name of w & " " & wd & "x" & ht & " " & subrole of w & "]"
            -- после закрытия Walt у Telegram может остаться скрытое безымянное окно
            if name of w is "" and wd > 200 and ht > 200 then
                set frontmost to true
                perform action "AXRaise" of w
                return "показано" & report
            end if
        end repeat
    end tell
end tell
return "нет окна" & report
EOF
)
echo "$(date '+%F %T') $result" >> "$LOG"

case "$result" in показано*) ;; *) open "$WALT_URL" ;; esac
