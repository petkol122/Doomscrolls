@echo off
echo EXTRA=[%CLIENT_ORIGIN_EXTRA%] > "c:\Users\petrj\Moje hry\Doomscrolls\.tmpscript\server.log"
cd /d "c:\Users\petrj\Moje hry\Doomscrolls\apps\server"
echo === tsx start === >> "c:\Users\petrj\Moje hry\Doomscrolls\.tmpscript\server.log"
call "node_modules\.bin\tsx" watch src\main.ts >> "c:\Users\petrj\Moje hry\Doomscrolls\.tmpscript\server.log" 2>&1
