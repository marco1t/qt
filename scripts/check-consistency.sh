#!/bin/bash
#
# check-consistency.sh - Verifie la coherence entre CMakeLists.txt, qmldir et les fichiers sur disque
#
# Usage: bash scripts/check-consistency.sh
#

set -e

ERRORS=0

# =============================================
# 1. Chaque QML_FILES dans CMakeLists.txt existe sur disque
# =============================================
echo "1. CMakeLists.txt -> fichiers sur disque"

QML_FILES=$(sed -n '/QML_FILES/,/RESOURCES/p' CMakeLists.txt | grep -E '\.qml$|\.js$' | sed 's/^[[:space:]]*//')

for f in $QML_FILES; do
    if [ ! -f "$f" ]; then
        echo "  FAIL $f (dans CMakeLists.txt mais absent du disque)"
        ERRORS=$((ERRORS+1))
    else
        echo "  OK   $f"
    fi
done

# =============================================
# 2. Chaque .qml/.js dans les dossiers QML est dans CMakeLists.txt
# =============================================
echo ""
echo "2. Fichiers sur disque -> CMakeLists.txt"

for dir in qml qml/components qml/screens qml/styles qml/js; do
    [ -d "$dir" ] || continue
    for f in $(ls "$dir"/*.qml "$dir"/*.js 2>/dev/null); do
        [ -f "$f" ] || continue
        if ! grep -q "$f" CMakeLists.txt; then
            echo "  FAIL $f (existe sur disque mais absent de CMakeLists.txt)"
            ERRORS=$((ERRORS+1))
        else
            echo "  OK   $f"
        fi
    done
done

# =============================================
# 3. Chaque entree qmldir pointe vers un fichier reel
# =============================================
echo ""
echo "3. qmldir -> fichiers sur disque"

for qmldir_file in qml/components/qmldir qml/screens/qmldir qml/styles/qmldir; do
    if [ ! -f "$qmldir_file" ]; then
        echo "  FAIL $qmldir_file manquant"
        ERRORS=$((ERRORS+1))
        continue
    fi

    dir=$(dirname "$qmldir_file")

    while IFS= read -r line; do
        # Skip module declaration, singleton prefix, empty lines
        [[ -z "$line" ]] && continue
        [[ "$line" =~ ^module ]] && continue

        # Extract filename (last field on the line)
        filename=$(echo "$line" | awk '{print $NF}')

        if [ ! -f "$dir/$filename" ]; then
            echo "  FAIL $dir/$filename (dans $qmldir_file mais absent)"
            ERRORS=$((ERRORS+1))
        else
            echo "  OK   $dir/$filename"
        fi
    done < "$qmldir_file"
done

# =============================================
# 4. Chaque .qml dans components/screens est dans son qmldir
# =============================================
echo ""
echo "4. Fichiers composants -> qmldir"

for dir in qml/components qml/screens; do
    qmldir_file="$dir/qmldir"
    [ -f "$qmldir_file" ] || continue

    for f in "$dir"/*.qml; do
        [ -f "$f" ] || continue
        basename=$(basename "$f")
        if ! grep -q "$basename" "$qmldir_file"; then
            echo "  FAIL $basename (dans $dir/ mais absent de $qmldir_file)"
            ERRORS=$((ERRORS+1))
        else
            echo "  OK   $basename (dans $qmldir_file)"
        fi
    done
done

# =============================================
# 5. Pas de secrets exposes dans le code
# =============================================
echo ""
echo "5. Detection de secrets"

SECRETS_FOUND=0
for pattern in 'password\s*[:=]' 'api_key\s*[:=]' 'secret_key' 'private_key' 'AWS_ACCESS'; do
    RESULTS=$(grep -rnI "$pattern" \
        --include="*.js" --include="*.qml" --include="*.cpp" --include="*.h" --include="*.json" \
        --exclude-dir=node_modules --exclude-dir=.git \
        --exclude="package-lock.json" --exclude="*.yml" . 2>/dev/null || true)
    if [ -n "$RESULTS" ]; then
        echo "  WARN Pattern suspect: $pattern"
        echo "$RESULTS" | head -3
        SECRETS_FOUND=$((SECRETS_FOUND+1))
    fi
done

if [ $SECRETS_FOUND -eq 0 ]; then
    echo "  OK   Aucun secret expose"
fi

# =============================================
# RESULTAT
# =============================================
echo ""
echo "========================================"
if [ $ERRORS -eq 0 ]; then
    echo "OK - Aucune incoherence detectee"
    exit 0
else
    echo "FAIL - $ERRORS incoherence(s) detectee(s)"
    exit 1
fi
