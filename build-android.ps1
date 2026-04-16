param(
    [string]$OutputName = "YanFlow-release.apk"
)

$ErrorActionPreference = "Stop"

function Get-JdkHome {
    $jdk = Get-ChildItem "C:\Program Files\Microsoft" -Directory |
        Where-Object { $_.Name -like "jdk-17*" } |
        Select-Object -First 1

    if (-not $jdk) {
        throw "JDK 17 not found."
    }

    return $jdk.FullName
}

function Invoke-External {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed: $FilePath $($Arguments -join ' ')"
    }
}

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$portableRoot = "C:\yanflow-android"
$sdkRoot = Join-Path $portableRoot "sdk"
$buildToolsVersion = "34.0.0"
$platformVersion = "android-34"
$jdkHome = Get-JdkHome

$env:JAVA_HOME = $jdkHome
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:PATH = "$jdkHome\bin;$env:PATH"

$buildTools = Join-Path $sdkRoot "build-tools\$buildToolsVersion"
$androidJar = Join-Path $sdkRoot "platforms\$platformVersion\android.jar"

$aapt2 = Join-Path $buildTools "aapt2.exe"
$aapt = Join-Path $buildTools "aapt.exe"
$d8 = Join-Path $buildTools "d8.bat"
$zipalign = Join-Path $buildTools "zipalign.exe"
$apksigner = Join-Path $buildTools "apksigner.bat"

$workRoot = Join-Path $portableRoot "work"
$generatedRoot = Join-Path $workRoot "generated"
$assetsRoot = Join-Path $generatedRoot "assets\www"
$classesRoot = Join-Path $generatedRoot "classes"
$classesJar = Join-Path $generatedRoot "classes.jar"
$resCompiled = Join-Path $generatedRoot "resources.zip"
$javaGenRoot = Join-Path $generatedRoot "java"
$unsignedApk = Join-Path $generatedRoot "yanflow-unsigned.apk"
$alignedApk = Join-Path $generatedRoot "yanflow-aligned.apk"
$outputRoot = Join-Path $projectRoot "android-build\output"
$outputApk = Join-Path $outputRoot $OutputName
$keystoreDir = Join-Path $projectRoot "android-build\keystore"
$keystore = Join-Path $keystoreDir "yanflow-debug.jks"
$sourceRoot = Join-Path $workRoot "source"
$appRoot = Join-Path $sourceRoot "android-app"

New-Item -ItemType Directory -Force -Path $portableRoot, $outputRoot, $keystoreDir | Out-Null

if (-not (Test-Path $sdkRoot)) {
    Copy-Item (Join-Path $projectRoot "android-sdk") $sdkRoot -Recurse -Force
}

Remove-Item $workRoot -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $assetsRoot, $classesRoot, $javaGenRoot, $sourceRoot | Out-Null

Copy-Item (Join-Path $projectRoot "android-app") $appRoot -Recurse -Force

$webFiles = @(
    "index.html",
    "styles.css",
    "app.js",
    "icon.svg",
    "manifest.webmanifest",
    "service-worker.js",
    "USAGE.md"
)

foreach ($file in $webFiles) {
    Copy-Item (Join-Path $projectRoot $file) (Join-Path $assetsRoot $file) -Force
}

Invoke-External $aapt2 @(
    "compile",
    "--dir", (Join-Path $appRoot "res"),
    "-o", $resCompiled
)

Invoke-External $aapt2 @(
    "link",
    "-I", $androidJar,
    "--manifest", (Join-Path $appRoot "AndroidManifest.xml"),
    "-o", $unsignedApk,
    "--java", $javaGenRoot,
    "-A", (Join-Path $generatedRoot "assets"),
    $resCompiled
)

$javaSources = @(
    (Join-Path $appRoot "src\com\c6tnt\yanflow\MainActivity.java"),
    (Join-Path $javaGenRoot "com\c6tnt\yanflow\R.java")
)

$javacArgs = @(
    "--release", "8",
    "-encoding", "UTF-8",
    "-cp", $androidJar,
    "-d", $classesRoot
)
$javacArgs += $javaSources
Invoke-External "javac" $javacArgs

Invoke-External "jar" @(
    "--create",
    "--file", $classesJar,
    "-C", $classesRoot,
    "."
)

Invoke-External $d8 @(
    "--lib", $androidJar,
    "--output", $generatedRoot,
    $classesJar
)

Invoke-External $aapt @(
    "add",
    $unsignedApk,
    (Join-Path $generatedRoot "classes.dex")
)

Invoke-External $zipalign @(
    "-f", "4",
    $unsignedApk,
    $alignedApk
)

if (-not (Test-Path $keystore)) {
    Invoke-External "keytool" @(
        "-genkeypair",
        "-keystore", $keystore,
        "-alias", "yanflow",
        "-storepass", "yanflow123",
        "-keypass", "yanflow123",
        "-dname", "CN=YanFlow, OU=YanFlow, O=YanFlow, L=Shanghai, ST=Shanghai, C=CN",
        "-keyalg", "RSA",
        "-keysize", "2048",
        "-validity", "3650"
    )
}

Invoke-External $apksigner @(
    "sign",
    "--ks", $keystore,
    "--ks-key-alias", "yanflow",
    "--ks-pass", "pass:yanflow123",
    "--key-pass", "pass:yanflow123",
    "--out", $outputApk,
    $alignedApk
)

Invoke-External $apksigner @(
    "verify",
    $outputApk
)
Write-Host ""
Write-Host "APK generated:" -ForegroundColor Green
Write-Host $outputApk
