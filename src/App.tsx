import { useState } from 'react'
import { S3Client, PutObjectCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3'

const env = import.meta.env
const bucket = env.VITE_S3_BUCKET as string
const endpoint = (env.VITE_S3_ENDPOINT as string).replace(/\/$/, '')
const s3 = new S3Client({
  endpoint,
  region: env.VITE_S3_REGION,
  forcePathStyle: env.VITE_S3_FORCE_PATH_STYLE === 'true',
  credentials: { accessKeyId: env.VITE_S3_ACCESS_KEY, secretAccessKey: env.VITE_S3_SECRET_KEY },
})

// make uploaded objects publicly readable (best effort)
s3.send(new PutBucketPolicyCommand({
  Bucket: bucket,
  Policy: JSON.stringify({
    Version: '2012-10-17',
    Statement: [{ Effect: 'Allow', Principal: { AWS: ['*'] }, Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${bucket}/avani/*`] }],
  }),
})).catch(() => {})

const letters = 'abcdefghijklmnopqrstuvwxyz'
const shortKey = () =>
  `avani/${Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * 26)]).join('')}/${Math.floor(100000 + Math.random() * 900000)}`

type Item = { name: string; url?: string; error?: string }

export default function App() {
  const [items, setItems] = useState<Item[]>([])
  const [busy, setBusy] = useState(false)

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    for (const f of Array.from(files)) {
      const key = shortKey()
      try {
        await s3.send(new PutObjectCommand({
          Bucket: bucket, Key: key, Body: new Uint8Array(await f.arrayBuffer()),
          ContentType: f.type || 'application/octet-stream',
          ContentDisposition: `inline; filename="${encodeURIComponent(f.name)}"`,
        }))
        setItems(p => [{ name: f.name, url: `${endpoint}/${bucket}/${key}` }, ...p])
      } catch (e) {
        setItems(p => [{ name: f.name, error: String(e) }, ...p])
      }
    }
    setBusy(false)
  }

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', fontFamily: 'sans-serif', padding: 16 }}>
      <h1>CDN Fast</h1>
      <label
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); upload(e.dataTransfer.files) }}
        style={{ display: 'block', border: '2px dashed #888', borderRadius: 12, padding: 40, textAlign: 'center', cursor: 'pointer' }}>
        {busy ? 'Uploading…' : 'Drop files here or click to choose'}
        <input type="file" multiple hidden onChange={e => upload(e.target.files)} />
      </label>
      <ul style={{ padding: 0, listStyle: 'none' }}>
        {items.map((it, i) => (
          <li key={i} style={{ margin: '12px 0', padding: 12, background: '#f4f4f4', borderRadius: 8 }}>
            <b>{it.name}</b><br />
            {it.url ? <>
              <a href={it.url} target="_blank">{it.url}</a>{' '}
              <button onClick={() => navigator.clipboard.writeText(it.url!)}>Copy</button>
            </> : <span style={{ color: 'red' }}>{it.error}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
