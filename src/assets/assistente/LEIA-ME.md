# Assistente do estoque

Modelo fornecido pelo Pedro em 22/10/2026, na pasta
`Meshy_AI_Violet_Greeting_biped/` da raiz. A personagem se chama **Assistente**.

`assistente.glb` contém a malha original (10.320 triângulos), o esqueleto e as
texturas do FBX `Meshy_AI_Violet_Greeting_biped_Meshy_Merged_Animations.fbx`.
A conversão mantém a malha; cor em WebP de 2.048 px, normal e superfície em
1.024 px, embutidas no GLB. Rugosidade no canal G e metal no B, como exige glTF.
A orientação vertical das imagens acompanha a conversão FBX → glTF.
Não precisa de API, CDN, Draco ou decodificador em worker no navegador.

Clipes selecionados do arquivo original:

- `Caminhar feminino`: `Walking_Woman`.
- `Carregar`: `Carry_Heavy_Object_Walk`.
- `Pegar e colocar`: `Female_Crouch_Pick_Up_Place_Side`.
- `Repouso`: primeiro quadro do clipe de pegar, mantido sem movimento.

Conversão local com Three.js FBXLoader/GLTFExporter e Pillow para as texturas.
Os outros clipes continuam no original. A escala do FBX é convertida para
1,85 m no código; o movimento horizontal dos clipes é removido na instância,
pois o trajeto da Assistente é definido pela planta do estoque.

O asset é importado pelo Vite com hash e só baixa ao abrir o estoque 3D.
Cada palco clona o esqueleto; geometria e texturas compartilham o cache.
