# Güvenlik

QuantumOrb hiç kimseden private key, seed phrase ya da para istemez. Bu kod yalnızca herkese açık API'leri
okur, işlem imzalamaz, cüzdana bağlanmaz. Bunu isteyen bir şey QuantumOrb değildir.

API anahtarları (`BUBBLEMAPS_API_KEY`, `GOPLUS_TOKEN`) ortam değişkeniyle verilir; `.env` dosyası
`.gitignore` içindedir ve depoya girmez.

## Açık bildirme

Bir güvenlik sorunu bulursanız lütfen ayrıntıyı herkese açık bir issue'da yazmayın. Başlığı **security**
olan, ayrıntısız bir issue açın; özel bir kanal kurulur.
