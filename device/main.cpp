#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <Adafruit_PN532.h>
#include <ESP32Servo.h>
#include <mbedtls/md.h>
#include <time.h>

// --- Backend configuration ---
const char* WIFI_SSID = "VIKESH-LOQ";
const char* WIFI_PASSWORD = "mekonipata";
const char* BACKEND_URL = "http://172.17.35.193:8000/api/device/verify";
const char* DEVICE_ID = "door-device-01";
const char* SECRET_KEY = "vikesh.dev";

// --- RFID SPI pins ---
#define PN532_SCK 33
#define PN532_MOSI 13
#define PN532_MISO 35
#define PN532_SS 25
Adafruit_PN532 nfc(PN532_SS);

// --- Servo ---
Servo myServo;
const int servoPin = 27;
const int servoClosedAngle = 180;
const int servoOpenAngle = 0;

// --- LED ---
const int ledPin = 4;

// --- Knock Sensor ---
const int knockSensor = 36;
int threshold = 800;
const unsigned long debounceTime = 250;
bool knockActive = false;
unsigned long lastKnockTime = 0;
int knockCount = 0;
const unsigned long interKnockTimeout = 2500;
unsigned long lastKnockDetected = 0;
const unsigned long rfidAttemptTimeout = 15000;

// --- Access state ---
bool accessGranted = false;
unsigned long accessStartTime = 0;
const unsigned long accessDuration = 10000;
bool rfidMatched = false;
String currentRfidTag = "";
unsigned long rfidScanTime = 0;

// --- IR Sensors ---
const int irA = 22;
const int irB = 23;
int totalPersons = 0;
bool prevA = HIGH;
bool prevB = HIGH;
unsigned long lastATime = 0;
unsigned long lastBTime = 0;
const unsigned long MAX_DIFF = 1000;
bool counted = false;

// --- Motor Relay ---
const int motorRelayPin = 26;
const bool relayActiveLow = true;

void connectToWifi();
void syncClock();
bool ensureBackendReady();
String uidToString(const uint8_t* uid, uint8_t uidLength);
String generateHmacSha256(const String& message, const String& secretKey);
String getTimestampMillisString();
bool verifyAccessWithBackend(const String& rfid, int knockCount);
void checkRFID();
void detectKnock();
void checkIR();
void blinkLED(int times);
void resetAccessAttempt();

void setup() {
	Serial.begin(115200);

	myServo.attach(servoPin);
	myServo.write(servoClosedAngle);

	pinMode(ledPin, OUTPUT);
	digitalWrite(ledPin, LOW);

	analogReadResolution(12);
	pinMode(knockSensor, INPUT);

	long sum = 0;
	for (int index = 0; index < 20; index++) {
		sum += analogRead(knockSensor);
		delay(5);
	}
	int baseline = sum / 20;
	threshold += baseline;
	Serial.print("Knock threshold set to: ");
	Serial.println(threshold);

	SPI.begin(PN532_SCK, PN532_MISO, PN532_MOSI, PN532_SS);
	nfc.begin();
	uint32_t versiondata = nfc.getFirmwareVersion();
	if (!versiondata) {
		Serial.println("PN532 not found!");
		while (true) {
			delay(1000);
		}
	}
	nfc.SAMConfig();
	Serial.println("Waiting for RFID card...");

	pinMode(irA, INPUT);
	pinMode(irB, INPUT);

	pinMode(motorRelayPin, OUTPUT);
	if (relayActiveLow) {
		digitalWrite(motorRelayPin, HIGH);
	} else {
		digitalWrite(motorRelayPin, LOW);
	}

	connectToWifi();
	syncClock();
}

void loop() {
	unsigned long now = millis();

	checkRFID();
	detectKnock();
	checkIR();

	if (rfidMatched && !accessGranted && now - rfidScanTime >= rfidAttemptTimeout) {
		Serial.println("RFID attempt timed out. Scan again.");
		blinkLED(2);
		resetAccessAttempt();
	}

	if (accessGranted && now - accessStartTime >= accessDuration) {
		myServo.write(servoClosedAngle);
		digitalWrite(ledPin, LOW);
		accessGranted = false;
		resetAccessAttempt();
	}

	if (totalPersons > 0) {
		if (relayActiveLow) {
			digitalWrite(motorRelayPin, LOW);
		} else {
			digitalWrite(motorRelayPin, HIGH);
		}
	} else {
		if (relayActiveLow) {
			digitalWrite(motorRelayPin, HIGH);
		} else {
			digitalWrite(motorRelayPin, LOW);
		}
	}

	delay(10);
}

void connectToWifi() {
	WiFi.mode(WIFI_STA);
	WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

	while (WiFi.status() != WL_CONNECTED) {
		delay(500);
		Serial.println("Connecting to WiFi...");
	}

	Serial.print("WiFi connected. IP: ");
	Serial.println(WiFi.localIP());
}

void syncClock() {
	configTime(0, 0, "pool.ntp.org", "time.nist.gov");

	time_t now = time(nullptr);
	while (now < 1700000000) {
		delay(500);
		Serial.println("Waiting for NTP time sync...");
		now = time(nullptr);
	}

	Serial.println("Clock synchronized");
}

bool ensureBackendReady() {
	if (WiFi.status() != WL_CONNECTED) {
		connectToWifi();
	}

	time_t now = time(nullptr);
	if (now < 1700000000) {
		syncClock();
		now = time(nullptr);
	}

	return now >= 1700000000;
}

String uidToString(const uint8_t* uid, uint8_t uidLength) {
	String tag;

	for (uint8_t index = 0; index < uidLength; index++) {
		if (uid[index] < 0x10) {
			tag += '0';
		}
		tag += String(uid[index], HEX);
	}

	tag.toUpperCase();
	return tag;
}

String generateHmacSha256(const String& message, const String& secretKey) {
	unsigned char hmacResult[32];
	mbedtls_md_context_t context;
	const mbedtls_md_info_t* info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);

	mbedtls_md_init(&context);
	mbedtls_md_setup(&context, info, 1);
	mbedtls_md_hmac_starts(
		&context,
		reinterpret_cast<const unsigned char*>(secretKey.c_str()),
		secretKey.length()
	);
	mbedtls_md_hmac_update(
		&context,
		reinterpret_cast<const unsigned char*>(message.c_str()),
		message.length()
	);
	mbedtls_md_hmac_finish(&context, hmacResult);
	mbedtls_md_free(&context);

	char hexOutput[65];
	for (int index = 0; index < 32; index++) {
		sprintf(&hexOutput[index * 2], "%02x", hmacResult[index]);
	}
	hexOutput[64] = '\0';

	return String(hexOutput);
}

String getTimestampMillisString() {
	unsigned long long epochMillis = static_cast<unsigned long long>(time(nullptr)) * 1000ULL;
	char timestampBuffer[24];
	snprintf(timestampBuffer, sizeof(timestampBuffer), "%llu", epochMillis);
	return String(timestampBuffer);
}

bool verifyAccessWithBackend(const String& rfid, int knocks) {
	if (!ensureBackendReady()) {
		Serial.println("Backend prerequisites not ready");
		return false;
	}

	String timestamp = getTimestampMillisString();
	String message = String(DEVICE_ID) + "|" + rfid + "|" + String(knocks) + "|" + timestamp;
	String signature = generateHmacSha256(message, SECRET_KEY);

	String requestBody = "{";
	requestBody += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
	requestBody += "\"rfid\":\"" + rfid + "\",";
	requestBody += "\"knockCount\":" + String(knocks) + ",";
	requestBody += "\"timestamp\":" + timestamp + ",";
	requestBody += "\"signature\":\"" + signature + "\"";
	requestBody += "}";

	HTTPClient http;
	http.setTimeout(10000);
	http.begin(BACKEND_URL);
	http.addHeader("Content-Type", "application/json");

	Serial.println("Sending signed access request to backend...");
	int responseCode = http.POST(requestBody);
	String responseBody = http.getString();
	http.end();

	Serial.print("Backend status: ");
	Serial.println(responseCode);
	Serial.println(responseBody);

	return responseCode == 200 && responseBody.indexOf("\"success\":true") >= 0;
}

void checkRFID() {
	if (rfidMatched || accessGranted) {
		return;
	}

	uint8_t success;
	uint8_t uid[7];
	uint8_t uidLength;
	success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength);

	if (success) {
		currentRfidTag = uidToString(uid, uidLength);
		rfidMatched = true;
		rfidScanTime = millis();
		knockCount = 0;
		lastKnockDetected = 0;

		Serial.print("RFID detected: ");
		Serial.println(currentRfidTag);
		Serial.println("Waiting for knock pattern...");
		blinkLED(1);
		delay(500);
	}
}

void detectKnock() {
	unsigned long now = millis();
	int value = analogRead(knockSensor);

	if (value >= threshold && !knockActive && now - lastKnockTime > debounceTime) {
		knockActive = true;
		lastKnockTime = now;
		knockCount++;
		lastKnockDetected = now;

		Serial.print("Knock detected! Count: ");
		Serial.println(knockCount);
		blinkLED(1);
	}

	if (value < threshold) {
		knockActive = false;
	}

	// After the user stops knocking, send the RFID + knock pattern to the backend.
	if (rfidMatched && knockCount > 0 && (now - lastKnockDetected > interKnockTimeout)) {
		bool authorized = verifyAccessWithBackend(currentRfidTag, knockCount);

		if (authorized) {
			Serial.println("Access granted by backend!");
			digitalWrite(ledPin, HIGH);
			myServo.write(servoOpenAngle);
			accessStartTime = now;
			accessGranted = true;
		} else {
			Serial.println("Access denied by backend. Scan RFID again.");
			blinkLED(2);
		}

		resetAccessAttempt();
	}
}

void checkIR() {
	int stateA = digitalRead(irA);
	int stateB = digitalRead(irB);
	unsigned long now = millis();

	if (stateA == LOW && prevA == HIGH) {
		lastATime = now;
	}
	if (stateB == LOW && prevB == HIGH) {
		lastBTime = now;
	}

	if (lastATime && lastBTime) {
		long diff = static_cast<long>(lastATime) - static_cast<long>(lastBTime);

		if (abs(diff) < MAX_DIFF && !counted) {
			if (diff < 0) {
				totalPersons++;
			} else {
				totalPersons--;
			}

			if (totalPersons < 0) {
				totalPersons = 0;
			}

			Serial.print("Total persons: ");
			Serial.println(totalPersons);
			counted = true;
		}

		if (abs(diff) >= MAX_DIFF || (stateA == HIGH && stateB == HIGH)) {
			lastATime = 0;
			lastBTime = 0;
			counted = false;
		}
	}

	prevA = stateA;
	prevB = stateB;
}

void blinkLED(int times) {
	for (int index = 0; index < times; index++) {
		digitalWrite(ledPin, HIGH);
		delay(150);
		digitalWrite(ledPin, LOW);
		delay(150);
	}
}

void resetAccessAttempt() {
	rfidMatched = false;
	currentRfidTag = "";
	knockCount = 0;
	lastKnockDetected = 0;
	rfidScanTime = 0;
}
