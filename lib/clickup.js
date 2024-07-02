export const createTask = async (idOfList, templateId, taskName, description) => {
    const listId = idOfList;
    const apiRoute = templateId ? 
            `https://api.clickup.com/api/v2/list/${listId}/taskTemplate/${templateId}` : 
            `https://api.clickup.com/api/v2/list/${listId}/task`;
  
    const status = await getDefaultStatus(listId)
    
    const other = { description: description, status: status };
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: process.env.CLICKUP_API_KEY
      },
      body: JSON.stringify({name: `${taskName} (${uniqid()})`, ...other})
    };
  
    const taskCreated = await fetch(apiRoute, options).then(data => data.json());
  
    if(templateId) {
      await fetch(
        `https://api.clickup.com/api/v2/task/${taskCreated.id}`, 
        {...options, method: 'PUT', body: JSON.stringify(other)}
      );
    }
    
    return taskCreated.task ? taskCreated.task : taskCreated;
  }
  
export const updateTask = async (taskId, fieldId, fieldValue) => {
    try{
      if(fieldValue != null || fieldValue != undefined) {
        const options = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: process.env.CLICKUP_API_KEY
          },
          body: JSON.stringify({value: fieldValue})
        };
        await fetch(`https://api.clickup.com/api/v2/task/${taskId}/field/${fieldId}`, options).then(data => data.json);
      }
    } catch {
      console.error('Value field is empty, task not updated');
    }
  }


// export  {
//   createTask,
//   updateTask
// };