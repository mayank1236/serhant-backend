import { createTask, updateTask } from '../../../../lib/clickup';
import { client } from '../../../../sanity/lib/client';
import { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
    console.log('This is working!!!!');
    const { entries, attachments, form, services, user, regionEmbed } = await request.json();    

    // deduplicate entries with multiple values

    const merged = Object.values(entries.reduce((item: any, { id, value }) => {
        item[id] ??= { id: id, value: [] };
        if (Array.isArray(value)) {
            item[id].value = item[id].value.concat(value);
        }
        else {
            item[id].value.push(value);
        }
        return item;
    }, {}))

    merged.forEach((item: any, i) => {
        const val: any = Object.values(item)
        if (val[1].length === 1) {
            merged[i] = { id: val[0], value: val[1][0] }
        }
    })

    const description = merged.map((item: any) => {
        return `${item.id}:  ${item.value}`
    }).join('\n')

    // create task from TaskTemplate in Clickup
    const task = await createTask(
        form.clickupListId,
        form.taskTemplate,
        services.services.title,
        description,
    );

    await task.custom_fields.forEach(async (field: any) => {
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

        const fieldValue = merged.find((formField: any) => formField.id.toLowerCase().replace(/\s+|[ :\-_]/g, "") == field.name.toLowerCase().replace(/\s+|[ :\-_]/g, ""))?.value;
        fieldValue && await updateTask(task.id, field.id, fieldValue);
    })
    // submit attachments to task

    if (attachments.length > 0 && task) {
        attachments.forEach(async (item: any, index: any) => {
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
        return new Response('Submitted to clickup!', {
            status: 200,
        })
    } else {
        console.log('Error Creating Task');
    }
}