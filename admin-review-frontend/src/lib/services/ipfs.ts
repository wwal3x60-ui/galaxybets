/**
 * IPFS Service - Handles direct browser uploads to IPFS via Pinata
 *
 * Note: This uploads directly from the browser using public env vars.
 */

const PINATA_API_KEY = process.env.NEXT_PUBLIC_PINATA_API_KEY || "";
const PINATA_API_SECRET = process.env.NEXT_PUBLIC_PINATA_API_SECRET || "";
const PINATA_BASE_URL = "https://api.pinata.cloud";
const PINATA_GATEWAY_URL =
  process.env.NEXT_PUBLIC_PINATA_GATEWAY_URL || "https://gateway.pinata.cloud/ipfs";

export interface IpfsUploadResult {
  ipfsHash: string;
  ipfsUrl: string;
  gatewayUrl: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export async function uploadToIpfs(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<IpfsUploadResult> {
  if (!PINATA_API_KEY || !PINATA_API_SECRET) {
    throw new Error("Pinata API credentials not configured");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are allowed");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image size must be less than 5MB");
  }

  const formData = new FormData();
  formData.append("file", file);

  const metadata = JSON.stringify({
    name: file.name,
    keyvalues: {
      uploadedAt: new Date().toISOString(),
    },
  });
  formData.append("pinataMetadata", metadata);

  const options = JSON.stringify({ cidVersion: 0 });
  formData.append("pinataOptions", options);

  return await new Promise<IpfsUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percentage: Math.round((e.loaded / e.total) * 100),
        });
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          const ipfsHash = response.IpfsHash;
          const gatewayUrl = `${PINATA_GATEWAY_URL}/${ipfsHash}`;

          resolve({
            ipfsHash,
            ipfsUrl: `ipfs://${ipfsHash}`,
            gatewayUrl,
          });
        } catch {
          reject(new Error("Failed to parse upload response"));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData.error || `Upload failed: ${xhr.statusText}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.statusText} (${xhr.status})`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload was aborted")));

    xhr.open("POST", `${PINATA_BASE_URL}/pinning/pinFileToIPFS`);
    xhr.setRequestHeader("pinata_api_key", PINATA_API_KEY);
    xhr.setRequestHeader("pinata_secret_api_key", PINATA_API_SECRET);
    xhr.send(formData);
  });
}

