import { server } from "./Utils/server"
import { Logs } from "./Utils/Logs"
import { baseSocket } from "./modules/_Base/socket"
import { Utils } from "./Utils/Utils"
import { criptManager } from "./Utils/criptManager"

Utils.configEnv()

const port = criptManager.getEnv("PORT")
const socketPort = criptManager.getEnv("SOCKETPORT")

server.app.listen(port, async () => {
    Logs.insertLog({ msg: "Api iniciada" })

    console.log(new Date().toLocaleString('pt-br'))
    console.log(`Aplicação rodando em: http://localhost:${port}`)
    console.log(`Socket rodando em: http://localhost:${socketPort}`)

    await Utils.sleep(3000)

    baseSocket.emmitReload()
})