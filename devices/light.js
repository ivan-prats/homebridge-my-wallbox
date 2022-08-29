let packageJson=require('../package.json')
let wallboxAPI=require('../wallboxapi')

function light (platform,log,config){
	this.log=log
	this.platform=platform
	this.wallboxapi=new wallboxAPI(this,log)
}

light.prototype={

  createLightService(device, type){
    this.log.debug('adding new light')
		let currentAmps=device.maxChargingCurrent
		let switchOn=false
		if(device.statusDescription=="Charging"){switchOn=true}
		let lightService=new Service.Lightbulb(type, device.id)
    lightService 
      .setCharacteristic(Characteristic.Name, type)
      .setCharacteristic(Characteristic.StatusFault,false)
			.setCharacteristic(Characteristic.Brightness, currentAmps)
			.setCharacteristic(Characteristic.On, switchOn)
    return lightService
  },

  configureLightService(device, lightService){
		let min=6
		let max=device.maxAvailableCurrent || 40
    this.log.info("Configured %s light for %s" , lightService.getCharacteristic(Characteristic.Name).value, device.name)
		lightService
      .getCharacteristic(Characteristic.On)
      .on('get', this.getLightState.bind(this, lightService))
      .on('set', this.setLightState.bind(this, device, lightService))
		lightService
      .getCharacteristic(Characteristic.Brightness)
			.setProps({
					minStep:1,
					minValue:min,
					maxValue:max
			})
      .on('get', this.getLightAmps.bind(this, lightService))
      .on('set', this.setLightAmps.bind(this, device, lightService))
  },

	setLightAmps(device, lightService, value, callback){
		this.wallboxapi.getChargerData(this.platform.token,device.id).then(response=>{
			try{
				locked=response.data.data.chargerData.locked
				this.log.debug('check lock state = %s',locked)
			}catch(error){
				locked=true
				this.log.error("failed lock state check")
			}			
			if(!locked){
				this.log.debug('set amps %s',lightService.getCharacteristic(Characteristic.Name).value)
				if(lightService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
					callback('error')
				}
				else{
					this.wallboxapi.setAmps(this.platform.token,device.id,value).then(response=>{
						switch(response.status){
							case 200:
								lightService.getCharacteristic(Characteristic.Brightness).updateValue(value)
								break
							default:
								lightService.getCharacteristic(Characteristic.On).updateValue(!value)
								this.log.info('Failed to start charging %s',response.data.title)
								this.log.debug(response.data)
								break
							}
						})	
					callback()
				} 
			}
			else{
				this.log.info('Charger must be unlocked for this operation')
				lightService.getCharacteristic(Characteristic.On).updateValue(!value)
				callback()
			}
		})
		//this.platform.startLiveUpdate(device)
	},

	setLightState(device, lightService, value, callback){
		this.wallboxapi.getChargerData(this.platform.token,device.id).then(response=>{
			try{
				locked=response.data.data.chargerData.locked
				this.log.debug('check lock state = %s',locked)
			}catch(error){
				locked=true
				this.log.error("failed lock state check")
			}			
			if(!locked){
				this.log.debug('toggle switch state %s',lightService.getCharacteristic(Characteristic.Name).value)
				if(lightService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
					callback('error')
				}
				else{
					if(value){
						this.wallboxapi.remoteAction(this.platform.token,device.id,'start').then(response=>{
							switch(response.status){
								case 200:
									lightService.getCharacteristic(Characteristic.On).updateValue(value)
									break
								default:
									lightService.getCharacteristic(Characteristic.On).updateValue(!value)
									this.log.info('Failed to start charging %s',response.data.title)
									this.log.debug(response.data)
									break
								}
						})	
					} 
					else {
						this.wallboxapi.remoteAction(this.platform.token,device.id,'pause').then(response=>{
							switch(response.status){
								case 200:
									lightService.getCharacteristic(Characteristic.On).updateValue(value)
									break
								default:
									lightService.getCharacteristic(Characteristic.On).updateValue(!value)
									this.log.info('Failed to pause charging %s',response.data.title)
									this.log.debug(response.data)
									break
								}
						})	
					}
					callback()
				} 
			}
			else{
				this.log.info('Charger must be unlocked for this operation')
				lightService.getCharacteristic(Characteristic.On).updateValue(!value)
				callback()
			}	
		})
		//this.platform.startLiveUpdate(device)
	},

	getLightState(lightService, callback){
		if(lightService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
			callback('error')
		}
		else{
			let currentValue=lightService.getCharacteristic(Characteristic.On).value
			callback(null, currentValue)
		}
	}, 

	getLightAmps(lightService, callback){
		if(lightService.getCharacteristic(Characteristic.StatusFault).value==Characteristic.StatusFault.GENERAL_FAULT){
			callback('error')
		}
		else{
			let currentValue=lightService.getCharacteristic(Characteristic.Brightness).value
			callback(null, currentValue)
		}
	} 

}

module.exports = light