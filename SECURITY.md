# Güvenlik

QuantumOrb hiç kimseden private key, seed phrase ya da para istemez. Bu kod yalnızca herkese açık API'leri ve
zinciri okur (`eth_call`, `eth_getLogs`), işlem imzalamaz, cüzdana bağlanmaz. Bunu isteyen bir şey QuantumOrb
değildir.

API anahtarları (`BUBBLEMAPS_API_KEY`, isteğe bağlı `GOPLUS_TOKEN`) ve RPC adresi (`BSC_RPC_URL`, anahtar
taşıyabilir) ortam değişkeniyle verilir; `.env` dosyası `.gitignore` içindedir ve depoya girmez. Lansman kaydı
(`data/`) de depoya girmez.

## Açık bildirme

Bir güvenlik sorunu bulursanız lütfen ayrıntıyı herkese açık bir issue'da yazmayın. Başlığı **security**
olan, ayrıntısız bir issue açın; özel bir kanal kurulur.
