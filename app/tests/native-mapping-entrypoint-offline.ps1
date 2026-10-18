# Execute production parameter validation/dispatch with an inert C# transport.
# No enumeration, HID imports, handles, queries or writes exist in this stub.
$ErrorActionPreference = 'Stop'
$text = Get-Content (Join-Path $PSScriptRoot '../native/brightness.ps1') -Raw
$stub = @'
public static class AulaBrightnessTransport {
    public static bool ConfigurationWriteAttempted = false;
    public static string RunMappings(bool write, string source, string target) {
        if (!write || source != "Digit1" || target != "Ctrl+Shift+KeyC")
            throw new System.Exception("Semantic mapping arguments were corrupted.");
        System.Console.Error.WriteLine("PASS: production entrypoint preserved Digit1 -> Ctrl+Shift+KeyC (case-insensitive PowerShell source collision regression); inert transport only.");
        return "[]";
    }
}
'@
$pattern = "(?s)(\`$source = @'\r?\n)(.*?)(\r?\n'@)"
$match = [regex]::Match($text, $pattern)
if (-not $match.Success) { throw 'Native source block missing' }
$inert = $text.Substring(0, $match.Groups[2].Index) + $stub + $text.Substring($match.Groups[2].Index + $match.Groups[2].Length)
& ([scriptblock]::Create($inert)) -Action SetMapping -Source Digit1 -Target 'Ctrl+Shift+KeyC'
