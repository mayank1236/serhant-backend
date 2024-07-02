import { createTask, updateTask } from './lib/clickup.js';
import { client } from './lib/sanity.js';
import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.post('/clickup', sendToClickup);

app.get('/', (req, res) => {
    res.send("Hello World")
})

app.listen(port, () => {
    console.log(`Serhant Request app listening on port ${port}`);
});

async function sendToClickup(request, response) {
    console.log('This is working!!!!');
    const { entries, attachments, form, services, user, regionEmbed } = request.body;    

    // deduplicate entries with multiple values

    const merged = Object.values(entries.reduce((item, { id, value }) => {
        item[id] ??= { id: id, value: [] };
        if (Array.isArray(value)) {
            item[id].value = item[id].value.concat(value);
        }
        else {
            item[id].value.push(value);
        }
        return item;
    }, {}))

    merged.forEach((item, i) => {
        const val = Object.values(item)
        if (val[1].length === 1) {
            merged[i] = { id: val[0], value: val[1][0] }
        }
    })

    const description = merged.map((item) => {
        return `${item.id}:  ${item.value}`
    }).join('\n')

    // create task from TaskTemplate in Clickup
    const task = await createTask(
        form.clickupListId,
        form.taskTemplate,
        services.services.title,
        description,
    );

    await task.custom_fields.forEach(async (field) => {
        // const user = JSON.parse(cookies().get('msalUser').value);

        switch (field.name) {
            case 'LISTING AGENT':
            case 'Lead Agent':
                await updateTask(task.id, field.id, user?.name);
                return;
            case 'Email':
                await updateTask(task.id, field.id, user?.email);
                return;
            case 'Phone #':
                await updateTask(task.id, field.id, user?.phone);
                return;
        }

        const fieldValue = merged.find((formField) => formField.id.toLowerCase().replace(/\s+|[ :\-_]/g, "") == field.name.toLowerCase().replace(/\s+|[ :\-_]/g, ""))?.value;
        fieldValue && await updateTask(task.id, field.id, fieldValue);
    })
    // submit attachments to task

    if (attachments.length > 0 && task) {
        attachments.forEach(async (item, index) => {
            // Extract base64 data
            const base64Data = item.data.split(',')[1]

            const buffer = Buffer.from(base64Data, "base64");

            const attachment = new FormData()
            attachment.append("attachment", new Blob([buffer], { type: 'application/octet-stream' }), item.name)
            await fetch(`https://api.clickup.com/api/v2/task/${task.id}/attachment`, {
                method: 'POST',
                headers: {
                    Authorization: process.env.CLICKUP_API_KEY || "",
                },
                body: attachment
            }).then(async (res) => {console.log(await res.json());});

        })
    }

    if (task) {
        await client.create({
            _type: 'requests',
            requestedBy: user.name,
            userId: user.id,
            taskId: task.id
        })  
        return response.send('Submitted to clickup!')
    } else {
        console.log('Error Creating Task');
    }
}