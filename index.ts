import { server } from "./Utils/server"
import { Logs } from "./Utils/Logs"
import { socket } from "./Utils/socket"
import { Utils } from "./Utils/Utils"
import { enviromentManager } from "./Utils/enviromentManager"

Utils.configEnv()

const port = enviromentManager.getEnv("PORT")
const socketPort = enviromentManager.getEnv("SOCKETPORT")

server.app.listen(port, async () => {
    Logs.insertLog({ msg: "Api iniciada" })

    console.log(new Date().toLocaleString('pt-br'))
    console.log(`Aplicação rodando em: http://localhost:${port}`)
    console.log(`Socket rodando em: http://localhost:${socketPort}`)

    await Utils.sleep(3000)

    socket.emmitReload()
})