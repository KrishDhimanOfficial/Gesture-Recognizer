import express from "express"
import { exec } from "node:child_process"
import cors from 'cors'
import { createServer } from "node:http"
const app = express()

app.use(cors({
    origin: 'http://localhost:3000',
    allowedHeaders: ['Content-Type', 'Authorization']
}))


app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.post('/api/gesture', (req, res) => {
    const { action, x, y } = req.body

    if (action === 'cursor') {
        exec(`cliclick m:${Math.round(x)},${Math.round(y)}`)
    }
    if (action === 'pinch') {
        exec(`cliclick c:.`)
    }
    if (action === 'double-tap') {
        exec(`cliclick dc:.`)
    }
    return res.status(200).json({ ok: true })
})

const Server = createServer(app)

Server.listen(4000, () => {
    console.log("Server started on port 4000")
})