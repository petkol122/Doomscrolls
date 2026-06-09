$f = 'c:\Users\petrj\Moje hry\Doomscrolls\packages\shared\src\protocol\ServerMessages.ts'
$c = Get-Content $f -Raw
$needle1 = "  readonly windupMs: number;`r`n}"
$repl1 = "  readonly windupMs: number;`r`n  readonly attackKind?: `"normal`" | `"heavy`";`r`n}"
$c = $c.Replace($needle1, $repl1)

$needle2 = "  readonly outcome: `"hit`" | `"miss`";`r`n  readonly damage?: number;"
$repl2 = "  readonly outcome: `"hit`" | `"miss`";`r`n  readonly attackKind?: `"normal`" | `"heavy`";`r`n  readonly damage?: number;"
$c = $c.Replace($needle2, $repl2)

Set-Content -Path $f -Value $c -NoNewline
Write-Host "done"
