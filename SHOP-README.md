# Shop — IKEA Italia (integração)

## Arquivos
- `index.html` — atualizado: botão shop ativo, pill de total, painel, modais, importmap Three.js
- `styles.css` — atualizado: estilos do shop no final do arquivo
- `shop.js` — NOVO: produtos, abas, cards, carrinho, order summary, IA "colocar na cena"
- `shop3d.js` — NOVO: viewer 3D Three.js (GLB/GLTF e FBX, com pré-load e cache)
- `scenes-fp.js` / `script-fp.js` — sem alterações (copiados só pra pasta ficar completa)

## Modelos 3D
Cada produto aponta para `assets/models/<id>.glb`:
vadholma, sunnersta, raskog, kivik, ektorp, klippan (.glb ou .fbx — troque a
extensão no array `SHOP_PRODUCTS` em shop.js se usar FBX).
Enquanto o arquivo não existir, o viewer usa um modelo público de demonstração
(SheenChair da Khronos). Basta soltar seus arquivos na pasta que eles assumem.

## Produtos (IKEA Itália, preços verificados em 29/07/2026)
Cozinha: VADHOLMA €729 · SUNNERSTA €139 · RÅSKOG €39,95
Living:  KIVIK €599 · EKTORP €399 · KLIPPAN €299
Nome, preço, link de compra e imagem oficial estão no array `SHOP_PRODUCTS`.

## IA (colocar móvel na cena)
Usa a mesma API key Gemini do painel de IA já existente (campo API Key).
Cada card de produto tem um botão AI (canto inferior esquerdo da imagem) que
abre o modal de simulação individual daquele móvel:
Capture scene → prompt → Place furniture in scene.
Envia screenshot da cena + foto do produto + instrução pros modelos
gemini-3.1-flash-image / gemini-3-pro-image. Não precisa estar no carrinho.

## Observação
O carrinho persiste em localStorage (chave `archviz-shop-cart`).
Requer servidor local (não abrir via file://) por causa dos módulos ES do Three.js.
