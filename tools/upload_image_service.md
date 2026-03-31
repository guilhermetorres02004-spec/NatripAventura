# Serviço de Upload de Imagens para Produtos

## Opção recomendada: Cloudinary

Cloudinary é um serviço gratuito para pequenas aplicações, fácil de integrar e gera URLs públicas para imagens.

### Passos para usar Cloudinary:

1. Crie uma conta gratuita em https://cloudinary.com/
2. Pegue suas credenciais (cloud name, API key, API secret)
3. No frontend, use o widget de upload ou envie imagens via API
4. No backend, armazene a URL retornada pelo Cloudinary como campo `img` do produto

### Exemplo de integração frontend (HTML/JS):

```html
<!-- Widget de upload Cloudinary -->
<script src="https://widget.cloudinary.com/v2.0/global/all.js"></script>
<button id="upload-btn">Enviar imagem</button>
<script>
const cloudName = 'SEU_CLOUD_NAME';
const uploadPreset = 'SEU_UPLOAD_PRESET';
document.getElementById('upload-btn').onclick = function() {
  window.cloudinary.openUploadWidget({
    cloudName,
    uploadPreset,
    sources: ['local', 'url', 'camera'],
    multiple: false,
    cropping: false,
    folder: 'produtos',
    resourceType: 'image'
  }, (error, result) => {
    if (!error && result && result.event === 'success') {
      const imageUrl = result.info.secure_url;
      // Salve imageUrl como capa do produto
      alert('Imagem enviada: ' + imageUrl);
    }
  });
};
</script>
```

### Backend: salve a URL retornada no campo `img` do produto

## Alternativas
- Firebase Storage
- Amazon S3
- Upload direto para seu backend (necessita API para receber arquivos)

Se quiser um exemplo para backend Node.js ou outro serviço, me avise!